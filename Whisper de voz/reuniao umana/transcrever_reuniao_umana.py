#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para transcrever o arquivo de reunião Umana
Transcreve: reuniao umana.m4a
Salva a transcrição na mesma pasta do arquivo original
"""

import os
import sys
import whisper
import torch
import shutil
from datetime import datetime

# Configurar encoding UTF-8 para Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Caminho do arquivo específico
ARQUIVO_AUDIO = r"C:\INTELIGENCIA ARTIFICAL\inteligencia artificial\SCRIPTS FUNCIONAIS\Whisper de voz\reuniao umana\reuniao umana.m4a"

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

def transcrever_arquivo(model, caminho_arquivo, pasta_saida, device):
    """
    Transcreve um arquivo de áudio usando configurações otimizadas
    Salva o arquivo de transcrição na pasta especificada
    """
    print(f"\n{'='*80}")
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
            
            # Salvar transcrição individual na mesma pasta do arquivo
            nome_base = os.path.splitext(os.path.basename(caminho_arquivo))[0]
            arquivo_saida = os.path.join(pasta_saida, f"transcricao_{nome_base}.txt")
            
            # Formatar duração corretamente
            duracao = resultado.get('duration', None)
            if duracao is not None:
                duracao_str = f"{duracao:.2f}s"
            else:
                duracao_str = "N/A"
            
            with open(arquivo_saida, 'w', encoding='utf-8') as f:
                f.write(f"🎵 TRANSCRIÇÃO - REUNIÃO UMANA\n")
                f.write(f"=" * 80 + "\n")
                f.write(f"📁 Arquivo: {os.path.basename(caminho_arquivo)}\n")
                f.write(f"⏱️ Duração: {duracao_str}\n")
                f.write(f"🌍 Idioma: {resultado.get('language', 'N/A')}\n")
                f.write(f"📅 Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"=" * 80 + "\n\n")
                f.write(texto)
            
            print(f"✅ Transcrição salva em: {arquivo_saida}")
            print(f"\n📝 TEXTO TRANSCRITO (primeiros 500 caracteres):")
            print(f"{'-'*80}")
            print(texto[:500] + "..." if len(texto) > 500 else texto)
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
    Função principal para transcrição do arquivo de reunião Umana
    """
    print("🎯 TRANSCRITOR DE REUNIÃO - REUNIÃO UMANA")
    print("=" * 80)
    
    # Verificar ffmpeg
    if not verificar_ffmpeg():
        return
    
    # Obter a pasta do arquivo de áudio
    pasta_audio = os.path.dirname(ARQUIVO_AUDIO)
    if not pasta_audio:
        pasta_audio = os.getcwd()
    
    print(f"📁 Pasta de trabalho: {pasta_audio}")
    
    # Verificar se o arquivo existe
    if not os.path.exists(ARQUIVO_AUDIO):
        print(f"❌ Arquivo não encontrado: {ARQUIVO_AUDIO}")
        return
    
    # Mostrar informações do arquivo
    tamanho = os.path.getsize(ARQUIVO_AUDIO) / (1024 * 1024)  # MB
    print(f"\n📁 ARQUIVO ENCONTRADO:")
    print("=" * 80)
    print(f"📄 {os.path.basename(ARQUIVO_AUDIO):<60} ({tamanho:.2f} MB)")
    print("=" * 80)
    
    # Detectar GPU
    device = detectar_gpu()
    
    # Carregar modelo
    model = carregar_modelo_whisper(device)
    if model is None:
        print("❌ Não foi possível carregar o modelo Whisper")
        return
    
    # Processar arquivo
    print(f"\n🚀 INICIANDO PROCESSAMENTO...")
    print("=" * 80)
    
    inicio = datetime.now()
    sucesso, texto = transcrever_arquivo(model, ARQUIVO_AUDIO, pasta_audio, device)
    
    # Resumo final
    fim = datetime.now()
    duracao = (fim - inicio).total_seconds()
    
    print(f"\n{'='*80}")
    if sucesso:
        print(f"🎉 PROCESSAMENTO CONCLUÍDO COM SUCESSO!")
        print(f"⏱️ Tempo total: {duracao:.2f}s ({duracao/60:.1f} minutos)")
    else:
        print(f"❌ PROCESSAMENTO FALHOU")
    print(f"{'='*80}")
    
    print(f"\n👋 Transcrição concluída! Arquivo salvo em: {pasta_audio}")

if __name__ == "__main__":
    main()

