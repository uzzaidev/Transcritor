#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para transcrever a reunião "implementação Umana".

O objetivo é ser robusto no Windows mesmo quando o nome da pasta/arquivo tem acentos.
Por isso, este script:
- Procura o arquivo de áudio (m4a/mp3/wav/mp4) dentro da pasta "Whisper de voz"
- Seleciona o que mais combina com o nome esperado da reunião
- Transcreve em PT-BR com Whisper e salva a transcrição na mesma pasta do áudio
"""

from __future__ import annotations

import os
import sys
import shutil
from datetime import datetime
from typing import Iterable, Optional

import torch
import whisper


# Configurar encoding UTF-8 para Windows (evita caracteres "quebrados" no print)
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")


# Pasta base do projeto (esta pasta: "Whisper de voz")
PASTA_BASE = os.path.dirname(os.path.abspath(__file__))

# Dica do nome do arquivo (usado só para achar o áudio mais facilmente)
NOME_REUNIAO_HINT = "reuniao na umana implemanta"

# Extensões suportadas para busca automática
EXTENSOES_AUDIO = (".m4a", ".mp3", ".wav", ".mp4")


def detectar_gpu() -> str:
    """Detecta se CUDA está disponível e retorna o device apropriado."""
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        print(f"🚀 GPU detectada: {gpu_name}")
        print(
            f"💾 VRAM disponível: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB"
        )
        return "cuda"

    print("⚠️ GPU não detectada, usando CPU")
    return "cpu"


def carregar_modelo_whisper(device: str):
    """Carrega o modelo Whisper (tenta small, depois base)."""
    print("⏳ Carregando modelo Whisper Small...")
    try:
        model = whisper.load_model("small", device=device)
        print("✅ Modelo carregado com sucesso!")
        return model
    except Exception as e:
        print(f"❌ Erro ao carregar modelo: {e}")
        print("🔄 Tentando carregar modelo Base...")
        try:
            model = whisper.load_model("base", device=device)
            print("✅ Modelo Base carregado com sucesso!")
            return model
        except Exception as e2:
            print(f"❌ Erro ao carregar modelo Base: {e2}")
            return None


def verificar_ffmpeg() -> bool:
    """Garante que o executável ffmpeg está disponível."""
    if shutil.which("ffmpeg") is None:
        print("❌ ffmpeg não encontrado no PATH do sistema.")
        print("💡 Instale o ffmpeg e adicione o diretório 'bin' nas variáveis de ambiente.")
        return False
    return True


def iter_arquivos_audio(base_dir: str) -> Iterable[str]:
    """Percorre recursivamente e retorna arquivos com extensões de áudio suportadas."""
    for root, _, files in os.walk(base_dir):
        for name in files:
            if name.lower().endswith(EXTENSOES_AUDIO):
                yield os.path.join(root, name)


def escolher_arquivo_audio(arquivos: list[str], hint: str) -> Optional[str]:
    """
    Escolhe o arquivo de áudio mais provável.

    Regra simples:
    - Se houver match por substring (case-insensitive) com `hint`, pega o primeiro
    - Senão, pega o primeiro da lista (ordem alfabética)
    """
    if not arquivos:
        return None

    arquivos_ordenados = sorted(arquivos, key=lambda p: os.path.basename(p).lower())
    hint_lower = hint.lower().strip()
    if hint_lower:
        for p in arquivos_ordenados:
            if hint_lower in os.path.basename(p).lower():
                return p

    return arquivos_ordenados[0]


def transcrever_arquivo(model, caminho_arquivo: str, pasta_saida: str, device: str) -> tuple[bool, str]:
    """Transcreve um arquivo de áudio e salva um `.txt` ao lado do áudio."""
    print(f"\n{'='*80}")
    print(f"🎵 Transcrevendo: {os.path.basename(caminho_arquivo)}")
    print(f"🔧 Device: {device}")
    print(f"{'='*80}")

    if not os.path.exists(caminho_arquivo):
        print(f"❌ Arquivo não encontrado: {caminho_arquivo}")
        return False, ""

    try:
        configuracao = {
            "language": "pt",
            "verbose": False,
            "condition_on_previous_text": False,
            "no_speech_threshold": 0.3,
            "logprob_threshold": -0.8,
        }
        if device == "cuda":
            configuracao["fp16"] = True

        print("🎤 Transcrevendo áudio...")
        resultado = model.transcribe(caminho_arquivo, **configuracao)

        if not resultado or not resultado.get("text"):
            print("❌ Nenhum texto foi transcrito")
            return False, ""

        texto = resultado["text"].strip()

        nome_base = os.path.splitext(os.path.basename(caminho_arquivo))[0]
        arquivo_saida = os.path.join(pasta_saida, f"transcricao_{nome_base}.txt")

        duracao = resultado.get("duration", None)
        duracao_str = f"{duracao:.2f}s" if duracao is not None else "N/A"

        with open(arquivo_saida, "w", encoding="utf-8") as f:
            f.write("🎵 TRANSCRIÇÃO - REUNIÃO IMPLEMENTAÇÃO UMANA\n")
            f.write("=" * 80 + "\n")
            f.write(f"📁 Arquivo: {os.path.basename(caminho_arquivo)}\n")
            f.write(f"⏱️ Duração: {duracao_str}\n")
            f.write(f"🌍 Idioma: {resultado.get('language', 'N/A')}\n")
            f.write(f"📅 Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 80 + "\n\n")
            f.write(texto)

        print(f"✅ Transcrição salva em: {arquivo_saida}")
        print("\n📝 TEXTO TRANSCRITO (primeiros 500 caracteres):")
        print(f"{'-'*80}")
        print(texto[:500] + "..." if len(texto) > 500 else texto)
        print(f"{'-'*80}")

        return True, texto
    except Exception as e:
        print(f"❌ Erro na transcrição: {e}")
        return False, ""


def main() -> None:
    print("🎯 TRANSCRITOR DE REUNIÃO - IMPLEMENTAÇÃO UMANA")
    print("=" * 80)

    if not verificar_ffmpeg():
        return

    # Busca automática do áudio (evita depender de caminho com acentos/encoding)
    arquivos = list(iter_arquivos_audio(PASTA_BASE))
    arquivo_audio = escolher_arquivo_audio(arquivos, NOME_REUNIAO_HINT)
    if not arquivo_audio:
        print(f"❌ Nenhum arquivo de áudio encontrado em: {PASTA_BASE}")
        print(f"📌 Extensões buscadas: {', '.join(EXTENSOES_AUDIO)}")
        return

    pasta_audio = os.path.dirname(arquivo_audio) or os.getcwd()
    tamanho = os.path.getsize(arquivo_audio) / (1024 * 1024)

    print(f"📁 Pasta de trabalho: {pasta_audio}")
    print("\n📁 ARQUIVO SELECIONADO:")
    print("=" * 80)
    print(f"📄 {os.path.basename(arquivo_audio):<60} ({tamanho:.2f} MB)")
    print("=" * 80)

    device = detectar_gpu()
    model = carregar_modelo_whisper(device)
    if model is None:
        print("❌ Não foi possível carregar o modelo Whisper")
        return

    print("\n🚀 INICIANDO PROCESSAMENTO...")
    print("=" * 80)

    inicio = datetime.now()
    sucesso, _ = transcrever_arquivo(model, arquivo_audio, pasta_audio, device)
    fim = datetime.now()
    duracao = (fim - inicio).total_seconds()

    print(f"\n{'='*80}")
    if sucesso:
        print("🎉 PROCESSAMENTO CONCLUÍDO COM SUCESSO!")
        print(f"⏱️ Tempo total: {duracao:.2f}s ({duracao/60:.1f} minutos)")
    else:
        print("❌ PROCESSAMENTO FALHOU")
    print(f"{'='*80}")

    print(f"\n👋 Transcrição concluída! Arquivo salvo em: {pasta_audio}")


if __name__ == "__main__":
    main()

