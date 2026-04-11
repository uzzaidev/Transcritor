#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script otimizado para transcrição de áudio com CUDA e seleção interativa
"""

import os
import whisper
import torch
from pathlib import Path
import glob
import shutil

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

def carregar_modelo_whisper(device, modelo="small"):
    """
    Carrega o modelo Whisper otimizado para o device
    """
    print(f"⏳ Carregando modelo Whisper {modelo.capitalize()}...")
    
    try:
        model = whisper.load_model(modelo, device=device)
        print("✅ Modelo carregado com sucesso!")
        return model, modelo
    except Exception as e:
        print(f"❌ Erro ao carregar modelo {modelo}: {e}")
        if modelo == "small":
            print("🔄 Tentando carregar modelo Base...")
            try:
                model = whisper.load_model("base", device=device)
                print("✅ Modelo Base carregado com sucesso!")
                return model, "base"
            except Exception as e2:
                print(f"❌ Erro ao carregar modelo Base: {e2}")
                print("🔄 Tentando carregar modelo Tiny...")
                try:
                    model = whisper.load_model("tiny", device=device)
                    print("✅ Modelo Tiny carregado com sucesso!")
                    return model, "tiny"
                except Exception as e3:
                    print(f"❌ Erro ao carregar modelo Tiny: {e3}")
                    return None, None
        return None, None

def verificar_ffmpeg():
    """
    Garante que o executável ffmpeg está disponível
    """
    # Whisper usa ffmpeg para ler o áudio. Sem ele, surge WinError 2 no Windows.
    if shutil.which("ffmpeg") is None:
        print("❌ ffmpeg não encontrado no PATH do sistema.")
        print("💡 Instale o ffmpeg e adicione o diretório 'bin' nas variáveis de ambiente.")
        print("   Sugestão: https://ffmpeg.org/download.html ou use pacote 'choco install ffmpeg'.")
        return False
    return True

def encontrar_arquivos_audio():
    """
    Encontra todos os arquivos de áudio no diretório atual
    """
    extensoes_audio = ['*.mp3', '*.wav', '*.m4a', '*.ogg', '*.flac', '*.aac', '*.wma']
    arquivos_encontrados = []
    
    print("🔍 Procurando arquivos de áudio...")
    
    for extensao in extensoes_audio:
        arquivos = glob.glob(extensao)
        arquivos_encontrados.extend(arquivos)
    
    # Ordenar por nome
    arquivos_encontrados.sort()
    
    return arquivos_encontrados

def exibir_menu_arquivos(arquivos):
    """
    Exibe menu numerado com os arquivos de áudio encontrados
    """
    print(f"\n📁 ARQUIVOS DE ÁUDIO ENCONTRADOS ({len(arquivos)}):")
    print("=" * 60)
    
    for i, arquivo in enumerate(arquivos, 1):
        tamanho = os.path.getsize(arquivo) / (1024 * 1024)  # MB
        print(f"{i:2d}. {arquivo:<40} ({tamanho:.1f} MB)")
    
    print("=" * 60)
    print("0. Sair")
    print("=" * 60)

def selecionar_arquivo(arquivos):
    """
    Permite ao usuário selecionar um arquivo via número
    """
    while True:
        try:
            escolha = input(f"\n🎯 Escolha um arquivo (1-{len(arquivos)}) ou 0 para sair: ").strip()
            
            if escolha == "0":
                print("👋 Saindo...")
                return None
            
            escolha_num = int(escolha)
            
            if 1 <= escolha_num <= len(arquivos):
                arquivo_selecionado = arquivos[escolha_num - 1]
                print(f"✅ Arquivo selecionado: {arquivo_selecionado}")
                return arquivo_selecionado
            else:
                print(f"❌ Número inválido! Escolha entre 1 e {len(arquivos)}")
                
        except ValueError:
            print("❌ Digite um número válido!")
        except KeyboardInterrupt:
            print("\n👋 Saindo...")
            return None

def transcrever_arquivo_otimizado(model, caminho_arquivo, device):
    """
    Transcreve um arquivo de áudio usando configurações otimizadas
    """
    print(f"\n🎵 Transcrevendo: {caminho_arquivo}")
    print(f"🔧 Device: {device}")
    
    # Verificar se arquivo existe
    if not os.path.exists(caminho_arquivo):
        print(f"❌ Arquivo não encontrado: {caminho_arquivo}")
        return False
    
    try:
        if not verificar_ffmpeg():
            # Comentário explicativo: abortamos cedo para orientar o usuário antes da chamada.
            return False
        # Configurações otimizadas e permissivas
        configuracao = {
            "language": "pt",
            "verbose": False,
            "condition_on_previous_text": False,
            "no_speech_threshold": 0.6,  # Mais permissivo para capturar mais áudio
            "logprob_threshold": -1.0,   # Mais permissivo
            "compression_ratio_threshold": 2.4,
            "temperature": 0.0
        }
        
        # Adicionar fp16 se for GPU
        if device == "cuda":
            configuracao["fp16"] = True
        
        print("🎤 Transcrevendo áudio...")
        resultado = model.transcribe(caminho_arquivo, **configuracao)
        
        if resultado and resultado.get('text'):
            texto = resultado['text']
            
            # Salvar transcrição
            nome_base = os.path.splitext(os.path.basename(caminho_arquivo))[0]
            arquivo_saida = f"transcricao_{nome_base}_otimizado.txt"
            
            with open(arquivo_saida, 'w', encoding='utf-8') as f:
                f.write(f"🎵 TRANSCRIÇÃO OTIMIZADA\n")
                f.write(f"=" * 60 + "\n")
                f.write(f"📁 Arquivo: {caminho_arquivo}\n")
                f.write(f"⏱️ Duração: {resultado.get('duration', 'N/A')}s\n")
                f.write(f"🌍 Idioma: {resultado.get('language', 'N/A')}\n")
                f.write(f"🔧 Device: {device}\n")
                f.write(f"🤖 Modelo: Small (Otimizado)\n")
                f.write(f"=" * 60 + "\n\n")
                f.write(texto)
            
            print(f"✅ Transcrição salva em: {arquivo_saida}")
            print(f"\n📝 TEXTO TRANSCRITO:\n")
            print("-" * 60)
            print(texto)
            print("-" * 60)
            
            return True
        else:
            print("❌ Nenhum texto foi transcrito")
            return False
            
    except Exception as e:
        print(f"❌ Erro na transcrição: {e}")
        return False

def main():
    """
    Função principal com menu interativo
    """
    print("🎯 TRANSCRITOR WHISPER OTIMIZADO")
    print("=" * 60)
    
    # Detectar GPU
    device = detectar_gpu()
    
    # Carregar modelo
    model, modelo_nome = carregar_modelo_whisper(device)
    if model is None:
        print("❌ Não foi possível carregar o modelo Whisper")
        return
    
    # Encontrar arquivos de áudio
    arquivos_audio = encontrar_arquivos_audio()
    
    if not arquivos_audio:
        print("❌ Nenhum arquivo de áudio encontrado!")
        print("\n💡 FORMATOS SUPORTADOS:")
        print("   .mp3, .wav, .m4a, .ogg, .flac, .aac, .wma")
        return
    
    # Loop principal
    while True:
        exibir_menu_arquivos(arquivos_audio)
        
        arquivo_selecionado = selecionar_arquivo(arquivos_audio)
        
        if arquivo_selecionado is None:
            break
        
        # Transcrever arquivo selecionado
        sucesso = transcrever_arquivo_otimizado(model, arquivo_selecionado, device)
        
        if sucesso:
            print("\n🎉 Transcrição concluída com sucesso!")
        else:
            print("\n❌ Falha na transcrição")
        
        # Perguntar se quer continuar
        continuar = input("\n🔄 Deseja transcrever outro arquivo? (s/N): ").lower()
        if continuar != 's':
            break
    
    print("\n👋 Obrigado por usar o Transcriter Whisper Otimizado!")

if __name__ == "__main__":
    main()
