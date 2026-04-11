#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para diagnosticar problemas com arquivos de áudio
"""

import os
import sys

def testar_whisper_basico(caminho):
    """
    Testa transcrição com configurações muito permissivas
    """
    print("\n[TESTE WHISPER]")
    print("-" * 60)
    
    try:
        import whisper
        import torch
        
        # Verificar arquivo
        if not os.path.exists(caminho):
            print(f"ERRO: Arquivo nao encontrado: {caminho}")
            return False
        
        tamanho = os.path.getsize(caminho)
        print(f"Arquivo: {caminho}")
        print(f"Tamanho: {tamanho / (1024*1024):.2f} MB")
        
        # Usar modelo tiny para teste rápido
        print("\nCarregando modelo Tiny...")
        device = "cpu"
        model = whisper.load_model("tiny", device=device)
        
        print("Transcrevendo com thresholds muito baixos...")
        
        # Configurações MUITO permissivas
        resultado = model.transcribe(
            caminho,
            language="pt",
            verbose=False,
            condition_on_previous_text=False,
            no_speech_threshold=0.6,  # Muito permissivo
            logprob_threshold=-1.0,   # Muito permissivo
            compression_ratio_threshold=2.4,
            temperature=0.0
        )
        
        print("\n" + "=" * 60)
        print("[RESULTADO]")
        print("=" * 60)
        
        if resultado and resultado.get('text'):
            texto = resultado['text'].strip()
            print(f"SUCESSO: Texto encontrado ({len(texto)} caracteres)")
            print(f"\nTexto: {texto[:500]}")
            
            # Informações adicionais
            if 'segments' in resultado:
                print(f"\nSegmentos: {len(resultado['segments'])}")
                for i, seg in enumerate(resultado['segments'][:3]):
                    print(f"  Segmento {i+1}: {seg.get('text', '')[:100]}")
            
            if 'language' in resultado:
                print(f"Idioma detectado: {resultado['language']}")
            
            return True
        else:
            print("FALHA: Nenhum texto transcrito")
            print("\nDetalhes do resultado:")
            print(f"  - Texto vazio: {not resultado.get('text')}")
            if 'segments' in resultado:
                print(f"  - Numero de segmentos: {len(resultado['segments'])}")
                if len(resultado['segments']) > 0:
                    print(f"  - Primeiro segmento: {resultado['segments'][0]}")
            
            return False
            
    except Exception as e:
        print(f"ERRO no teste Whisper: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    arquivo = "Lucas email.mp3"
    
    print("=" * 60)
    print("DIAGNOSTICO DE AUDIO")
    print("=" * 60)
    
    testar_whisper_basico(arquivo)
    
    print("\n" + "=" * 60)
    print("Diagnostico concluido")
    print("=" * 60)

if __name__ == "__main__":
    main()
