#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para diagnosticar problemas com arquivos de áudio - salva em arquivo
"""

import os
import sys

def testar_whisper_basico(caminho, arquivo_saida):
    """
    Testa transcrição com configurações muito permissivas
    """
    with open(arquivo_saida, 'w', encoding='utf-8') as f:
        f.write("\n[TESTE WHISPER]\n")
        f.write("-" * 60 + "\n")
        
        try:
            import whisper
            import torch
            
            # Verificar arquivo
            if not os.path.exists(caminho):
                f.write(f"ERRO: Arquivo nao encontrado: {caminho}\n")
                return False
            
            tamanho = os.path.getsize(caminho)
            f.write(f"Arquivo: {caminho}\n")
            f.write(f"Tamanho: {tamanho / (1024*1024):.2f} MB\n")
            
            # Usar modelo tiny para teste rápido
            f.write("\nCarregando modelo Tiny...\n")
            device = "cpu"
            model = whisper.load_model("tiny", device=device)
            
            f.write("Transcrevendo com thresholds muito baixos...\n")
            
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
            
            f.write("\n" + "=" * 60 + "\n")
            f.write("[RESULTADO]\n")
            f.write("=" * 60 + "\n")
            
            if resultado and resultado.get('text'):
                texto = resultado['text'].strip()
                f.write(f"SUCESSO: Texto encontrado ({len(texto)} caracteres)\n")
                f.write(f"\nTexto completo:\n{texto}\n")
                
                # Informações adicionais
                if 'segments' in resultado:
                    f.write(f"\nSegmentos: {len(resultado['segments'])}\n")
                    for i, seg in enumerate(resultado['segments']):
                        f.write(f"  Segmento {i+1}: {seg.get('text', '')}\n")
                
                if 'language' in resultado:
                    f.write(f"\nIdioma detectado: {resultado['language']}\n")
                
                return True
            else:
                f.write("FALHA: Nenhum texto transcrito\n")
                f.write("\nDetalhes do resultado:\n")
                f.write(f"  - Texto vazio: {not resultado.get('text')}\n")
                if 'segments' in resultado:
                    f.write(f"  - Numero de segmentos: {len(resultado['segments'])}\n")
                    if len(resultado['segments']) > 0:
                        f.write(f"  - Primeiro segmento: {resultado['segments'][0]}\n")
                
                return False
                
        except Exception as e:
            f.write(f"ERRO no teste Whisper: {e}\n")
            import traceback
            f.write(traceback.format_exc())
            return False

def main():
    arquivo = "Lucas email.mp3"
    arquivo_saida = "resultado_diagnostico.txt"
    
    print("Executando diagnostico...")
    print(f"Resultado sera salvo em: {arquivo_saida}")
    
    testar_whisper_basico(arquivo, arquivo_saida)
    
    print("Diagnostico concluido!")
    print(f"Verifique o arquivo: {arquivo_saida}")

if __name__ == "__main__":
    main()
