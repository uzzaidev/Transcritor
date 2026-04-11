#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para diagnosticar problemas com arquivos de áudio
"""

import os
import sys
from pathlib import Path

def verificar_arquivo(caminho):
    """
    Verifica informações básicas do arquivo
    """
    print(f"📁 Arquivo: {caminho}")
    print("=" * 60)
    
    if not os.path.exists(caminho):
        print("❌ Arquivo não encontrado!")
        return False
    
    tamanho = os.path.getsize(caminho)
    print(f"📦 Tamanho: {tamanho / (1024*1024):.2f} MB ({tamanho} bytes)")
    
    if tamanho == 0:
        print("❌ Arquivo vazio!")
        return False
    
    return True

def diagnosticar_com_ffmpeg(caminho):
    """
    Usa ffmpeg para obter informações detalhadas do áudio
    """
    import subprocess
    
    print("\n🔍 Analisando com FFmpeg...")
    print("-" * 60)
    
    try:
        # Obter informações do arquivo
        cmd = ['ffmpeg', '-i', caminho, '-hide_banner']
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        # FFmpeg coloca informações no stderr
        output = result.stderr
        
        # Extrair informações relevantes
        print(output)
        
        # Verificar se tem stream de áudio
        if 'Audio:' not in output:
            print("\n❌ Nenhum stream de áudio detectado!")
            return False
        
        print("\n✅ Stream de áudio detectado")
        return True
        
    except FileNotFoundError:
        print("❌ FFmpeg não encontrado no sistema")
        return False
    except Exception as e:
        print(f"❌ Erro ao analisar: {e}")
        return False

def testar_whisper_basico(caminho):
    """
    Testa transcrição com configurações muito permissivas
    """
    print("\n🎤 Testando com Whisper (configuração permissiva)...")
    print("-" * 60)
    
    try:
        import whisper
        import torch
        
        # Usar modelo tiny para teste rápido
        print("⏳ Carregando modelo Tiny...")
        device = "cpu"
        model = whisper.load_model("tiny", device=device)
        
        print("🔄 Transcrevendo com thresholds muito baixos...")
        
        # Configurações MUITO permissivas
        resultado = model.transcribe(
            caminho,
            language="pt",
            verbose=True,
            condition_on_previous_text=False,
            no_speech_threshold=0.6,  # Muito permissivo
            logprob_threshold=-1.0,   # Muito permissivo
            compression_ratio_threshold=2.4,
            temperature=0.0
        )
        
        print("\n" + "=" * 60)
        print("📊 RESULTADO DO TESTE")
        print("=" * 60)
        
        if resultado and resultado.get('text'):
            texto = resultado['text'].strip()
            print(f"✅ Texto encontrado ({len(texto)} caracteres)")
            print(f"\n📝 Texto: {texto[:200]}...")
            
            # Informações adicionais
            if 'segments' in resultado:
                print(f"📍 Segmentos: {len(resultado['segments'])}")
            if 'language' in resultado:
                print(f"🌍 Idioma detectado: {resultado['language']}")
            
            return True
        else:
            print("❌ Nenhum texto transcrito")
            print("\n🔍 Detalhes do resultado:")
            print(f"   - Texto vazio: {not resultado.get('text')}")
            if 'segments' in resultado:
                print(f"   - Número de segmentos: {len(resultado['segments'])}")
                if len(resultado['segments']) > 0:
                    print(f"   - Primeiro segmento: {resultado['segments'][0]}")
            
            return False
            
    except Exception as e:
        print(f"❌ Erro no teste Whisper: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    arquivo = "Lucas email.mp3"
    
    print("🔬 DIAGNÓSTICO DE ÁUDIO")
    print("=" * 60)
    print()
    
    # 1. Verificar arquivo
    if not verificar_arquivo(arquivo):
        return
    
    # 2. Diagnosticar com FFmpeg
    diagnosticar_com_ffmpeg(arquivo)
    
    # 3. Testar com Whisper
    testar_whisper_basico(arquivo)
    
    print("\n" + "=" * 60)
    print("✅ Diagnóstico concluído")
    print("=" * 60)

if __name__ == "__main__":
    main()
