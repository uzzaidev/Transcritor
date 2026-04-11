#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para transcrever 11 arquivos específicos do WhatsApp em ordem cronológica
"""

import os
import whisper
import torch
from datetime import datetime

# Lista exata dos 11 arquivos na ordem cronológica
ARQUIVOS = [
    "Áudio do WhatsApp de 2025-11-25 à(s) 12.48.47_23405f16.mp3",
    "Áudio do WhatsApp de 2025-11-25 à(s) 12.48.47_abab66f1.mp3",
    "Áudio do WhatsApp de 2025-11-25 à(s) 12.48.47_b9fa5db5.mp3",
    "Áudio do WhatsApp de 2025-11-25 à(s) 13.06.13_13f9ea11.mp3",
    "Áudio do WhatsApp de 2025-11-25 à(s) 13.06.13_d31a8207.mp3",
    "Áudio do WhatsApp de 2025-11-25 à(s) 13.06.14_96dcf47c.mp3",
    "Áudio do WhatsApp de 2025-11-25 à(s) 13.23.51_4d962c40.mp3",
    "Áudio do WhatsApp de 2025-11-25 à(s) 13.24.42_501e75bf.mp3",
    "Áudio do WhatsApp de 2025-11-25 à(s) 13.42.46_b3695bc8.mp3",
    "Áudio do WhatsApp de 2025-11-25 à(s) 13.45.21_e312e113.mp3",
    "Áudio do WhatsApp de 2025-11-25 à(s) 13.50.09_0d42b61b.mp3"
]

def detectar_gpu():
    """Detecta se CUDA está disponível"""
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        print(f"🚀 GPU detectada: {gpu_name}")
        return "cuda"
    else:
        print("⚠️ GPU não detectada, usando CPU")
        return "cpu"

def carregar_modelo(device):
    """Carrega o modelo Whisper"""
    print("⏳ Carregando modelo Whisper Small...")
    try:
        model = whisper.load_model("small", device=device)
        print("✅ Modelo carregado!")
        return model
    except Exception as e:
        print(f"❌ Erro: {e}")
        print("🔄 Tentando modelo Base...")
        return whisper.load_model("base", device=device)

def transcrever_arquivo(model, arquivo, device, indice, total):
    """Transcreve um arquivo específico"""
    print(f"\n{'='*80}")
    print(f"📝 ARQUIVO {indice}/{total}: {arquivo}")
    print(f"{'='*80}")
    
    if not os.path.exists(arquivo):
        print(f"❌ Arquivo não encontrado!")
        return False, ""
    
    try:
        # Configurações otimizadas
        config = {
            "language": "pt",
            "verbose": False,
            "condition_on_previous_text": False,
            "no_speech_threshold": 0.3,
            "logprob_threshold": -0.8
        }
        
        if device == "cuda":
            config["fp16"] = True
        
        print("🎤 Transcrevendo...")
        resultado = model.transcribe(arquivo, **config)
        
        if resultado and resultado.get('text'):
            texto = resultado['text'].strip()
            duracao = resultado.get('duration', 0)
            
            # Salvar transcrição individual
            nome_base = os.path.splitext(arquivo)[0]
            arquivo_saida = f"transcricao_{nome_base}.txt"
            
            with open(arquivo_saida, 'w', encoding='utf-8') as f:
                f.write(f"🎵 TRANSCRIÇÃO\n")
                f.write(f"=" * 80 + "\n")
                f.write(f"📁 Arquivo: {arquivo}\n")
                f.write(f"⏱️ Duração: {duracao:.2f}s\n")
                f.write(f"📅 Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"=" * 80 + "\n\n")
                f.write(texto)
            
            print(f"✅ Salvo: {arquivo_saida}")
            print(f"\n📝 TEXTO:")
            print(f"{'-'*80}")
            print(texto)
            print(f"{'-'*80}")
            
            return True, texto
        else:
            print("❌ Nenhum texto transcrito")
            return False, ""
            
    except Exception as e:
        print(f"❌ Erro na transcrição: {e}")
        return False, ""

def main():
    """Função principal"""
    print("🎯 TRANSCRITOR DE 11 CONVERSAS DO WHATSAPP")
    print("=" * 80)
    
    # Detectar GPU e carregar modelo
    device = detectar_gpu()
    model = carregar_modelo(device)
    
    print(f"\n📁 PROCESSANDO {len(ARQUIVOS)} ARQUIVOS")
    print("=" * 80)
    
    sucessos = 0
    falhas = 0
    inicio = datetime.now()
    transcricoes = []
    
    # Processar cada arquivo
    for i, arquivo in enumerate(ARQUIVOS, 1):
        sucesso, texto = transcrever_arquivo(model, arquivo, device, i, len(ARQUIVOS))
        
        if sucesso:
            sucessos += 1
            transcricoes.append({
                'arquivo': arquivo,
                'texto': texto,
                'indice': i
            })
        else:
            falhas += 1
    
    # Criar arquivo consolidado
    if transcricoes:
        print(f"\n📄 Criando arquivo consolidado...")
        arquivo_consolidado = f"CONVERSAS_COMPLETAS_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        with open(arquivo_consolidado, 'w', encoding='utf-8') as f:
            f.write("💬 CONVERSAS DO WHATSAPP - TRANSCRIÇÕES COMPLETAS\n")
            f.write("=" * 80 + "\n")
            f.write(f"📅 Data: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"📊 Total: {len(transcricoes)} áudios\n")
            f.write("=" * 80 + "\n\n")
            
            for trans in transcricoes:
                f.write(f"\n{'─'*80}\n")
                f.write(f"🎵 ÁUDIO {trans['indice']}: {trans['arquivo']}\n")
                f.write(f"{'─'*80}\n")
                f.write(f"{trans['texto']}\n\n")
        
        print(f"✅ Arquivo consolidado: {arquivo_consolidado}")
    
    # Resumo
    fim = datetime.now()
    duracao = (fim - inicio).total_seconds()
    
    print(f"\n{'='*80}")
    print(f"🎉 CONCLUÍDO!")
    print(f"{'='*80}")
    print(f"✅ Sucessos: {sucessos}")
    print(f"❌ Falhas: {falhas}")
    print(f"⏱️ Tempo total: {duracao:.1f}s ({duracao/60:.1f} min)")
    if sucessos > 0:
        print(f"⚡ Média por arquivo: {duracao/sucessos:.1f}s")
    print(f"{'='*80}")

if __name__ == "__main__":
    main()
