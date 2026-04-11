#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para transcrever APENAS os arquivos de áudio da pasta raiz
Autor: Assistente IA
Data: 2025-01-13
"""

import os
import sys
import whisper
from pathlib import Path
import glob

def transcrever_com_whisper(caminho_arquivo, modelo="base"):
    """
    Transcreve áudio usando Whisper
    """
    print(f"🎵 Iniciando transcrição com Whisper...")
    print(f"📁 Arquivo: {caminho_arquivo}")
    print(f"🤖 Modelo: {modelo}")
    
    try:
        # Carregar modelo Whisper
        print("⏳ Carregando modelo Whisper...")
        model = whisper.load_model(modelo)
        
        # Transcrever áudio
        print("🎤 Transcrevendo áudio...")
        resultado = model.transcribe(caminho_arquivo, language="pt")
        
        print("✅ Transcrição concluída com sucesso!")
        return resultado
        
    except Exception as e:
        print(f"❌ Erro na transcrição: {e}")
        return None

def salvar_transcricao(texto, arquivo_original, metodo, resultado_completo=None):
    """
    Salva a transcrição em arquivo
    """
    # Nome do arquivo baseado no arquivo original
    nome_base = os.path.splitext(os.path.basename(arquivo_original))[0]
    arquivo_saida = f"transcricao_{nome_base}_{metodo}.txt"
    
    with open(arquivo_saida, 'w', encoding='utf-8') as f:
        f.write(f"🎵 TRANSCRIÇÃO DO ÁUDIO\n")
        f.write(f"=" * 60 + "\n")
        f.write(f"📅 Data: 2025-01-13\n")
        f.write(f"📁 Arquivo: {arquivo_original}\n")
        f.write(f"🤖 Método: {metodo}\n")
        
        if resultado_completo:
            f.write(f"⏱️ Duração: {resultado_completo.get('duration', 'N/A')}s\n")
            f.write(f"🌍 Idioma: {resultado_completo.get('language', 'N/A')}\n")
        
        f.write(f"=" * 60 + "\n\n")
        f.write(texto)
    
    print(f"\n🎉 === TRANSCRIÇÃO SALVA COM SUCESSO! ===")
    print(f"📁 Arquivo: {arquivo_saida}")
    print(f"\n📝 TEXTO TRANSCRITO:\n")
    print("-" * 60)
    print(texto)
    print("-" * 60)

def encontrar_arquivos_audio_raiz():
    """
    Encontra APENAS os arquivos de áudio na pasta raiz (não subpastas)
    """
    extensoes_audio = ['*.opus', '*.mp3', '*.wav', '*.m4a', '*.ogg', '*.flac', '*.aac', '*.wma']
    arquivos_encontrados = []
    
    print(f"🔍 Procurando arquivos de áudio na pasta raiz...")
    
    for extensao in extensoes_audio:
        arquivos = glob.glob(extensao)
        for arquivo in arquivos:
            # Verificar se é arquivo (não pasta) e está na raiz
            if os.path.isfile(arquivo) and not os.path.sep in arquivo:
                arquivos_encontrados.append(arquivo)
                print(f"  📁 Encontrado: {arquivo}")
    
    print(f"\n📊 Total de arquivos encontrados na raiz: {len(arquivos_encontrados)}")
    return arquivos_encontrados

def processar_arquivo(arquivo):
    """
    Processa um único arquivo de áudio
    """
    print(f"\n{'='*80}")
    print(f"🎵 PROCESSANDO: {arquivo}")
    print(f"{'='*80}")
    
    # Verificar se já foi transcrito
    nome_base = os.path.splitext(os.path.basename(arquivo))[0]
    arquivo_transcricao_existente = f"transcricao_{nome_base}_whisper_direto.txt"
    
    if os.path.exists(arquivo_transcricao_existente):
        print(f"⚠️ Transcrição já existe: {arquivo_transcricao_existente}")
        print("⏭️ Pulando arquivo...")
        return True
    
    # Tentar transcrição direta com Whisper
    resultado = transcrever_com_whisper(arquivo, "base")
    
    if resultado and resultado.get('text'):
        texto = resultado['text']
        salvar_transcricao(texto, arquivo, "whisper_direto", resultado)
        return True
    else:
        print(f"❌ Falha na transcrição de: {arquivo}")
        return False

def main():
    """
    Função principal - processa apenas arquivos da pasta raiz
    """
    print("🎯 === TRANSCRITOR WHISPER - PASTA RAIZ ===")
    print("=" * 60)
    
    # Encontrar arquivos de áudio na raiz
    arquivos_audio = encontrar_arquivos_audio_raiz()
    
    if not arquivos_audio:
        print("❌ Nenhum arquivo de áudio encontrado na pasta raiz!")
        return
    
    # Estatísticas
    sucessos = 0
    falhas = 0
    
    # Processar cada arquivo
    for i, arquivo in enumerate(arquivos_audio, 1):
        print(f"\n🎯 ARQUIVO {i}/{len(arquivos_audio)}")
        
        try:
            if processar_arquivo(arquivo):
                sucessos += 1
                print(f"✅ Sucesso: {arquivo}")
            else:
                falhas += 1
                print(f"❌ Falha: {arquivo}")
                
        except Exception as e:
            falhas += 1
            print(f"❌ Erro inesperado em {arquivo}: {e}")
    
    # Relatório final
    print(f"\n{'='*60}")
    print(f"📊 === RELATÓRIO FINAL ===")
    print(f"{'='*60}")
    print(f"📁 Total de arquivos processados: {sucessos + falhas}")
    print(f"✅ Sucessos: {sucessos}")
    print(f"❌ Falhas: {falhas}")
    print(f"📈 Taxa de sucesso: {(sucessos/(sucessos+falhas)*100):.1f}%" if (sucessos+falhas) > 0 else "0%")
    print(f"\n🎉 Processamento concluído!")

if __name__ == "__main__":
    main()
