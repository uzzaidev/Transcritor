#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para transcrever 4 reuniões da semana sprint em formato .m4a
Transcreve: erika incubadora.m4a, luciano.m4a, Luiscasa.m4a, Reunião vini.m4a
Salva as transcrições na mesma pasta dos arquivos originais
"""

import os
import whisper
import torch
import shutil
from datetime import datetime

# Lista dos 4 arquivos específicos na ordem
ARQUIVOS = [
    "erika incubadora.m4a",
    "luciano.m4a",
    "Luiscasa.m4a",
    "Reunião vini.m4a"
]

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
    Necessário para processar arquivos .m4a
    """
    if shutil.which("ffmpeg") is None:
        print("❌ ffmpeg não encontrado no PATH do sistema.")
        print("💡 Instale o ffmpeg e adicione o diretório 'bin' nas variáveis de ambiente.")
        print("💡 O ffmpeg é necessário para converter arquivos .m4a")
        return False
    return True

def transcrever_arquivo(model, caminho_arquivo, pasta_saida, device, indice, total):
    """
    Transcreve um arquivo de áudio .m4a usando configurações otimizadas
    Salva o arquivo de transcrição na pasta especificada
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
        # Configurações otimizadas para português
        configuracao = {
            "language": "pt",
            "verbose": False,
            "condition_on_previous_text": False,
            "no_speech_threshold": 0.3,
            "logprob_threshold": -0.8
        }
        
        if device == "cuda":
            configuracao["fp16"] = True
        
        print("🎤 Transcrevendo áudio .m4a...")
        print("⏳ Isso pode levar alguns minutos dependendo do tamanho do arquivo...")
        resultado = model.transcribe(caminho_arquivo, **configuracao)
        
        if resultado and resultado.get('text'):
            texto = resultado['text'].strip()
            
            # Salvar transcrição individual na mesma pasta dos arquivos
            nome_base = os.path.splitext(os.path.basename(caminho_arquivo))[0]
            arquivo_saida = os.path.join(pasta_saida, f"transcricao_{nome_base}.txt")
            
            # Formatar duração corretamente
            duracao = resultado.get('duration', None)
            if duracao is not None:
                duracao_str = f"{duracao:.2f}s ({duracao/60:.1f} minutos)"
            else:
                duracao_str = "N/A"
            
            with open(arquivo_saida, 'w', encoding='utf-8') as f:
                f.write(f"🎵 TRANSCRIÇÃO DE REUNIÃO\n")
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
            preview = texto[:500] + "..." if len(texto) > 500 else texto
            print(preview)
            print(f"{'-'*80}")
            print(f"📊 Total de caracteres: {len(texto)}")
            
            return True, texto
        else:
            print("❌ Nenhum texto foi transcrito")
            return False, ""
            
    except Exception as e:
        print(f"❌ Erro na transcrição: {e}")
        import traceback
        print(f"📋 Detalhes do erro:")
        traceback.print_exc()
        return False, ""

def main():
    """
    Função principal para transcrição das 4 reuniões
    """
    print("🎯 TRANSCRITOR DE REUNIÕES - SEMANA SPRINT")
    print("=" * 80)
    
    # Verificar ffmpeg (essencial para .m4a)
    if not verificar_ffmpeg():
        return
    
    # Obter o diretório do script (onde estão os arquivos)
    pasta_atual = os.path.dirname(os.path.abspath(__file__))
    if not pasta_atual:
        pasta_atual = os.getcwd()
    
    print(f"📁 Pasta de trabalho: {pasta_atual}")
    
    # Detectar GPU
    device = detectar_gpu()
    
    # Carregar modelo
    model = carregar_modelo_whisper(device)
    if model is None:
        print("❌ Não foi possível carregar o modelo Whisper")
        return
    
    # Verificar se os arquivos existem
    arquivos_completos = []
    for arquivo in ARQUIVOS:
        caminho_completo = os.path.join(pasta_atual, arquivo)
        if os.path.exists(caminho_completo):
            arquivos_completos.append(caminho_completo)
        else:
            print(f"⚠️ Arquivo não encontrado: {caminho_completo}")
    
    if not arquivos_completos:
        print("❌ Nenhum arquivo de áudio encontrado!")
        return
    
    # Mostrar arquivos encontrados
    print(f"\n📁 ARQUIVOS ENCONTRADOS: {len(arquivos_completos)}/{len(ARQUIVOS)}")
    print("=" * 80)
    for i, arquivo in enumerate(arquivos_completos, 1):
        tamanho = os.path.getsize(arquivo) / (1024 * 1024)  # MB
        print(f"{i:2d}. {os.path.basename(arquivo):<60} ({tamanho:.2f} MB)")
    print("=" * 80)
    
    # Processar automaticamente
    print(f"\n🚀 INICIANDO PROCESSAMENTO...")
    print("=" * 80)
    
    sucessos = 0
    falhas = 0
    inicio = datetime.now()
    transcricoes = []
    
    for i, arquivo in enumerate(arquivos_completos, 1):
        sucesso, texto = transcrever_arquivo(model, arquivo, pasta_atual, device, i, len(arquivos_completos))
        
        if sucesso:
            sucessos += 1
            transcricoes.append({
                'arquivo': os.path.basename(arquivo),
                'texto': texto,
                'indice': i
            })
        else:
            falhas += 1
    
    # Criar arquivo consolidado com todas as transcrições na mesma pasta
    if transcricoes:
        print(f"\n📄 Criando arquivo consolidado...")
        arquivo_consolidado = os.path.join(pasta_atual, f"reunioes_completas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt")
        
        with open(arquivo_consolidado, 'w', encoding='utf-8') as f:
            f.write("💬 REUNIÕES SEMANA SPRINT - TRANSCRIÇÕES COMPLETAS\n")
            f.write("=" * 80 + "\n")
            f.write(f"📅 Data de processamento: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"📊 Total de reuniões: {len(transcricoes)}\n")
            f.write("=" * 80 + "\n\n")
            
            for trans in transcricoes:
                f.write(f"\n{'─'*80}\n")
                f.write(f"🎵 REUNIÃO {trans['indice']}: {trans['arquivo']}\n")
                f.write(f"{'─'*80}\n")
                f.write(f"{trans['texto']}\n\n")
        
        print(f"✅ Arquivo consolidado criado: {arquivo_consolidado}")
    
    # Resumo final
    fim = datetime.now()
    duracao = (fim - inicio).total_seconds()
    
    print(f"\n{'='*80}")
    print(f"🎉 PROCESSAMENTO CONCLUÍDO!")
    print(f"{'='*80}")
    print(f"✅ Sucessos: {sucessos}")
    print(f"❌ Falhas: {falhas}")
    print(f"📊 Total: {len(arquivos_completos)}")
    print(f"⏱️ Tempo total: {duracao:.2f}s ({duracao/60:.1f} minutos)")
    if sucessos > 0:
        print(f"⚡ Tempo médio por arquivo: {duracao/sucessos:.2f}s ({duracao/sucessos/60:.1f} minutos)")
    print(f"{'='*80}")
    
    print(f"\n👋 Transcrição concluída! Arquivos salvos em: {pasta_atual}")

if __name__ == "__main__":
    main()



