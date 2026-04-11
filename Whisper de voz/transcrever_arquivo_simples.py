#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script simples para transcrição de um único arquivo de áudio
"""

import os
import whisper
from pathlib import Path

def transcrever_arquivo_simples(caminho_arquivo):
    """
    Transcreve um único arquivo de áudio usando Whisper
    """
    print(f"🎵 Transcrevendo: {caminho_arquivo}")
    
    # Verificar se arquivo existe
    if not os.path.exists(caminho_arquivo):
        print(f"❌ Arquivo não encontrado: {caminho_arquivo}")
        return False
    
    try:
        # Carregar modelo Whisper (base é mais rápido)
        print("⏳ Carregando modelo Whisper...")
        model = whisper.load_model("base")
        
        # Transcrever áudio
        print("🎤 Transcrevendo áudio...")
        resultado = model.transcribe(caminho_arquivo, language="pt")
        
        if resultado and resultado.get('text'):
            texto = resultado['text']
            
            # Salvar transcrição
            nome_base = os.path.splitext(os.path.basename(caminho_arquivo))[0]
            arquivo_saida = f"transcricao_{nome_base}_simples.txt"
            
            with open(arquivo_saida, 'w', encoding='utf-8') as f:
                f.write(f"🎵 TRANSCRIÇÃO SIMPLES\n")
                f.write(f"=" * 50 + "\n")
                f.write(f"📁 Arquivo: {caminho_arquivo}\n")
                f.write(f"⏱️ Duração: {resultado.get('duration', 'N/A')}s\n")
                f.write(f"🌍 Idioma: {resultado.get('language', 'N/A')}\n")
                f.write(f"=" * 50 + "\n\n")
                f.write(texto)
            
            print(f"✅ Transcrição salva em: {arquivo_saida}")
            print(f"\n📝 TEXTO TRANSCRITO:\n")
            print("-" * 50)
            print(texto)
            print("-" * 50)
            
            return True
        else:
            print("❌ Nenhum texto foi transcrito")
            return False
            
    except Exception as e:
        print(f"❌ Erro na transcrição: {e}")
        return False

if __name__ == "__main__":
    # Arquivo específico que você quer transcrever
    arquivo = "AUDIO 2 PAPA E BOB.wav"
    
    print("🎯 TRANSCRIÇÃO SIMPLES DE ÁUDIO")
    print("=" * 50)
    
    if transcrever_arquivo_simples(arquivo):
        print("\n🎉 Transcrição concluída com sucesso!")
    else:
        print("\n❌ Falha na transcrição")

