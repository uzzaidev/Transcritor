#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para transcrever o arquivo de conversa UzAI no carro
Transcreve: Voz 012_W_20260220_204757.m4a
Salva a transcrição na mesma pasta do arquivo original
"""

import os
import whisper
import torch
import shutil
from datetime import datetime

# Arquivo a ser transcrito
ARQUIVO = "Voz 012_W_20260220_204757.m4a"

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
    
    tamanho = os.path.getsize(caminho_arquivo) / (1024 * 1024)
    print(f"📦 Tamanho do arquivo: {tamanho:.2f} MB")
    
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
            
            # Salvar transcrição na mesma pasta do arquivo
            nome_base = os.path.splitext(os.path.basename(caminho_arquivo))[0]
            arquivo_saida = os.path.join(pasta_saida, f"transcricao_{nome_base}.txt")
            
            # Formatar duração
            duracao = resultado.get('duration', None)
            duracao_str = f"{duracao:.2f}s" if duracao is not None else "N/A"
            
            with open(arquivo_saida, 'w', encoding='utf-8') as f:
                f.write(f"🎵 TRANSCRIÇÃO - CONVERSA CARRO UZAI\n")
                f.write(f"{'='*80}\n")
                f.write(f"📁 Arquivo: {os.path.basename(caminho_arquivo)}\n")
                f.write(f"⏱️ Duração: {duracao_str}\n")
                f.write(f"🌍 Idioma detectado: {resultado.get('language', 'N/A')}\n")
                f.write(f"📅 Data de processamento: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"{'='*80}\n\n")
                f.write(texto)
            
            print(f"✅ Transcrição salva em: {arquivo_saida}")
            print(f"\n📝 TEXTO TRANSCRITO:")
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
    Função principal para transcrição da conversa UzAI
    """
    print("🎯 TRANSCRITOR - CONVERSA CARRO UZAI")
    print("=" * 80)
    
    # Verificar ffmpeg
    if not verificar_ffmpeg():
        return
    
    # Pasta onde está o script (mesma pasta do áudio)
    pasta_atual = os.path.dirname(os.path.abspath(__file__))
    if not pasta_atual:
        pasta_atual = os.getcwd()
    
    print(f"📁 Pasta de trabalho: {pasta_atual}")
    
    caminho_arquivo = os.path.join(pasta_atual, ARQUIVO)
    
    # Verificar se o arquivo existe
    if not os.path.exists(caminho_arquivo):
        print(f"❌ Arquivo não encontrado: {caminho_arquivo}")
        print(f"💡 Certifique-se de que '{ARQUIVO}' está na pasta: {pasta_atual}")
        return
    
    tamanho = os.path.getsize(caminho_arquivo) / (1024 * 1024)
    print(f"✅ Arquivo encontrado: {ARQUIVO} ({tamanho:.2f} MB)")
    
    # Detectar GPU
    device = detectar_gpu()
    
    # Carregar modelo
    model = carregar_modelo_whisper(device)
    if model is None:
        print("❌ Não foi possível carregar o modelo Whisper")
        return
    
    # Transcrever
    inicio = datetime.now()
    sucesso, texto = transcrever_arquivo(model, caminho_arquivo, pasta_atual, device)
    fim = datetime.now()
    duracao_total = (fim - inicio).total_seconds()
    
    # Resumo final
    print(f"\n{'='*80}")
    print(f"🎉 PROCESSAMENTO CONCLUÍDO!")
    print(f"{'='*80}")
    if sucesso:
        print(f"✅ Transcrição realizada com sucesso")
        print(f"📊 Caracteres transcritos: {len(texto)}")
    else:
        print(f"❌ Falha na transcrição")
    print(f"⏱️ Tempo total: {duracao_total:.2f}s ({duracao_total/60:.1f} minutos)")
    print(f"{'='*80}")
    
    print(f"\n👋 Processo concluído! Arquivo salvo em: {pasta_atual}")

if __name__ == "__main__":
    main()
