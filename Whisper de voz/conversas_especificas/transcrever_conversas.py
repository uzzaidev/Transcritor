#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para transcrição em lote de conversas específicas do WhatsApp
"""

import os
import whisper
import torch
from pathlib import Path
import glob
import shutil
from datetime import datetime

def detectar_gpu():
    """
    Detecta se CUDA está disponível e retorna o device apropriado
    """
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        print(f"🚀 GPU detectada: {gpu_name}")
        print(f"💾 VRAM disponível: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
        return "cuda"
    else:
        print("⚠️ GPU não detectada, usando CPU")
        return "cpu"

def carregar_modelo_whisper(device):
    """
    Carrega o modelo Whisper otimizado para o device
    """
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

def verificar_ffmpeg():
    """
    Garante que o executável ffmpeg está disponível
    """
    if shutil.which("ffmpeg") is None:
        print("❌ ffmpeg não encontrado no PATH do sistema.")
        print("💡 Instale o ffmpeg e adicione o diretório 'bin' nas variáveis de ambiente.")
        return False
    return True

def transcrever_arquivo(model, caminho_arquivo, device, indice, total):
    """
    Transcreve um arquivo de áudio usando configurações otimizadas
    """
    print(f"\n{'='*80}")
    print(f"📝 ARQUIVO {indice}/{total}")
    print(f"🎵 Transcrevendo: {os.path.basename(caminho_arquivo)}")
    print(f"🔧 Device: {device}")
    print(f"{'='*80}")
    
    if not os.path.exists(caminho_arquivo):
        print(f"❌ Arquivo não encontrado: {caminho_arquivo}")
        return False, ""
    
    try:
        # Configurações otimizadas
        configuracao = {
            "language": "pt",
            "verbose": False,
            "condition_on_previous_text": False,
            "no_speech_threshold": 0.3,
            "logprob_threshold": -0.8
        }
        
        if device == "cuda":
            configuracao["fp16"] = True
        
        print("🎤 Transcrevendo áudio...")
        resultado = model.transcribe(caminho_arquivo, **configuracao)
        
        if resultado and resultado.get('text'):
            texto = resultado['text'].strip()
            
            # Salvar transcrição individual
            nome_base = os.path.splitext(os.path.basename(caminho_arquivo))[0]
            arquivo_saida = f"transcricao_{nome_base}.txt"
            
            with open(arquivo_saida, 'w', encoding='utf-8') as f:
                f.write(f"🎵 TRANSCRIÇÃO\n")
                f.write(f"=" * 80 + "\n")
                f.write(f"📁 Arquivo: {os.path.basename(caminho_arquivo)}\n")
                f.write(f"⏱️ Duração: {resultado.get('duration', 'N/A'):.2f}s\n")
                f.write(f"🌍 Idioma: {resultado.get('language', 'N/A')}\n")
                f.write(f"📅 Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"=" * 80 + "\n\n")
                f.write(texto)
            
            print(f"✅ Transcrição salva em: {arquivo_saida}")
            print(f"\n📝 TEXTO TRANSCRITO:")
            print(f"{'-'*80}")
            print(texto)
            print(f"{'-'*80}")
            
            return True, texto
        else:
            print("❌ Nenhum texto foi transcrito")
            return False, ""
            
    except Exception as e:
        print(f"❌ Erro na transcrição: {e}")
        return False, ""

def main():
    """
    Função principal para transcrição das conversas específicas
    """
    print("🎯 TRANSCRITOR DE CONVERSAS DO WHATSAPP")
    print("=" * 80)
    
    # Verificar ffmpeg
    if not verificar_ffmpeg():
        return
    
    # Detectar GPU
    device = detectar_gpu()
    
    # Carregar modelo
    model = carregar_modelo_whisper(device)
    if model is None:
        print("❌ Não foi possível carregar o modelo Whisper")
        return
    
    # Encontrar todos os arquivos .opus na pasta atual
    arquivos_audio = sorted(glob.glob("*.opus") + glob.glob("*.waptt.opus"))
    
    if not arquivos_audio:
        print("❌ Nenhum arquivo de áudio encontrado nesta pasta!")
        return
    
    # Mostrar arquivos encontrados
    print(f"\n📁 ARQUIVOS ENCONTRADOS: {len(arquivos_audio)}")
    print("=" * 80)
    for i, arquivo in enumerate(arquivos_audio, 1):
        tamanho = os.path.getsize(arquivo) / (1024 * 1024)  # MB
        print(f"{i:2d}. {arquivo:<60} ({tamanho:.2f} MB)")
    print("=" * 80)
    
    # Processar automaticamente
    print(f"\n🚀 INICIANDO PROCESSAMENTO...")
    print("=" * 80)
    
    sucessos = 0
    falhas = 0
    inicio = datetime.now()
    transcricoes = []
    
    for i, arquivo in enumerate(arquivos_audio, 1):
        sucesso, texto = transcrever_arquivo(model, arquivo, device, i, len(arquivos_audio))
        
        if sucesso:
            sucessos += 1
            transcricoes.append({
                'arquivo': os.path.basename(arquivo),
                'texto': texto,
                'indice': i
            })
        else:
            falhas += 1
    
    # Criar arquivo consolidado com todas as transcrições
    if transcricoes:
        print(f"\n📄 Criando arquivo consolidado...")
        arquivo_consolidado = f"conversas_completas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        with open(arquivo_consolidado, 'w', encoding='utf-8') as f:
            f.write("💬 CONVERSAS DO WHATSAPP - TRANSCRIÇÕES COMPLETAS\n")
            f.write("=" * 80 + "\n")
            f.write(f"📅 Data de processamento: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"📊 Total de áudios: {len(transcricoes)}\n")
            f.write("=" * 80 + "\n\n")
            
            for trans in transcricoes:
                f.write(f"\n{'─'*80}\n")
                f.write(f"🎵 ÁUDIO {trans['indice']}: {trans['arquivo']}\n")
                f.write(f"{'─'*80}\n")
                f.write(f"{trans['texto']}\n")
        
        print(f"✅ Arquivo consolidado criado: {arquivo_consolidado}")
    
    # Resumo final
    fim = datetime.now()
    duracao = (fim - inicio).total_seconds()
    
    print(f"\n{'='*80}")
    print(f"🎉 PROCESSAMENTO CONCLUÍDO!")
    print(f"{'='*80}")
    print(f"✅ Sucessos: {sucessos}")
    print(f"❌ Falhas: {falhas}")
    print(f"📊 Total: {len(arquivos_audio)}")
    print(f"⏱️ Tempo total: {duracao:.2f}s ({duracao/60:.1f} minutos)")
    if sucessos > 0:
        print(f"⚡ Tempo médio por arquivo: {duracao/sucessos:.2f}s")
    print(f"{'='*80}")
    
    print("\n👋 Transcrição concluída! Verifique os arquivos gerados.")

if __name__ == "__main__":
    main()
