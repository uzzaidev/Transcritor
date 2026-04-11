#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para transcrição de áudio usando Whisper
Autor: Assistente IA
Data: 2025-01-13
"""

import os
import sys
import whisper
from pathlib import Path

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

def converter_para_audio_valido(arquivo_original):
    """
    Tenta converter o arquivo para um formato de áudio válido
    """
    print(f"\n🔄 Tentando converter arquivo para formato válido...")
    
    try:
        from pydub import AudioSegment
        
        # Tentar diferentes formatos
        formatos_teste = ['mp3', 'm4a', 'ogg', 'flac']
        
        for formato in formatos_teste:
            try:
                print(f"📝 Tentando formato: {formato}")
                
                # Carregar áudio
                audio = AudioSegment.from_file(arquivo_original, format=formato)
                
                # Converter para WAV (formato mais compatível)
                arquivo_wav = f"audio_convertido_{formato}.wav"
                
                print(f"💾 Exportando como WAV...")
                audio.export(arquivo_wav, format="wav", parameters=["-ac", "1", "-ar", "16000"])
                
                print(f"✅ Conversão bem-sucedida: {arquivo_wav}")
                return arquivo_wav
                
            except Exception as e:
                print(f"❌ Formato {formato} falhou: {e}")
                continue
                
    except ImportError:
        print("❌ pydub não disponível")
    except Exception as e:
        print(f"❌ Erro geral: {e}")
    
    return None

def analisar_arquivo(caminho_arquivo):
    """
    Analisa o arquivo para entender sua estrutura
    """
    print(f"\n🔍 ANALISANDO ARQUIVO ===")
    
    if not os.path.exists(caminho_arquivo):
        print(f"❌ Arquivo não encontrado: {caminho_arquivo}")
        return False
    
    # Informações básicas
    tamanho = os.path.getsize(caminho_arquivo)
    print(f"📊 Tamanho: {tamanho / (1024*1024):.2f} MB")
    
    # Ler primeiros bytes
    try:
        with open(caminho_arquivo, 'rb') as f:
            header = f.read(32)
            
        print(f"🔬 Primeiros bytes: {header.hex()}")
        
        # Verificar assinaturas conhecidas
        if header.startswith(b'ID3') or header.startswith(b'\xff\xfb'):
            print("🎵 Formato detectado: MP3")
            return True
        elif header.startswith(b'RIFF'):
            print("🎵 Formato detectado: WAV")
            return True
        elif header.startswith(b'ftyp'):
            print("🎵 Formato detectado: M4A/MP4")
            return True
        elif header.startswith(b'OggS'):
            print("🎵 Formato detectado: OGG")
            return True
        elif header.startswith(b'fLaC'):
            print("🎵 Formato detectado: FLAC")
            return True
        elif header.startswith(b'OpusHead'):
            print("🎵 Formato detectado: OPUS")
            return True
        else:
            print("❓ Formato não reconhecido")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao analisar: {e}")
        return False

def encontrar_arquivos_audio(pasta_raiz="."):
    """
    Encontra todos os arquivos de áudio na pasta raiz e subpastas
    """
    extensoes_audio = {'.opus', '.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.wma', '.mp4', '.avi', '.mov'}
    arquivos_encontrados = []

    print(f"🔍 Procurando arquivos de áudio em: {os.path.abspath(pasta_raiz)}")

    for root, _, files in os.walk(pasta_raiz):
        for file in files:
            # Verificar extensão
            _, ext = os.path.splitext(file.lower())
            if ext in extensoes_audio:
                caminho_completo = os.path.join(root, file)
                arquivos_encontrados.append(caminho_completo)
                print(f"  📁 Encontrado: {caminho_completo}")

    print(f"\n📊 Total de arquivos encontrados: {len(arquivos_encontrados)}")
    return arquivos_encontrados

def processar_arquivo_unico(arquivo_original):
    """
    Processa um único arquivo de áudio
    """
    print(f"\n{'='*80}")
    print(f"🎵 PROCESSANDO: {arquivo_original}")
    print(f"{'='*80}")

    # Verificar se arquivo existe
    if not os.path.exists(arquivo_original):
        print(f"❌ Arquivo não encontrado: {arquivo_original}")
        return False

    # Verificar se já foi transcrito
    nome_base = os.path.splitext(os.path.basename(arquivo_original))[0]
    arquivo_transcricao_existente = f"transcricao_{nome_base}_whisper_direto.txt"

    if os.path.exists(arquivo_transcricao_existente):
        print(f"⚠️ Transcrição já existe: {arquivo_transcricao_existente}")
        resposta = input("Deseja reprocessar? (s/N): ").lower()
        if resposta != 's':
            print("⏭️ Pulando arquivo...")
            return True

    # Etapa 1: Analisar arquivo
    if not analisar_arquivo(arquivo_original):
        print("⚠️ Arquivo pode não ser um áudio válido")

    # Etapa 2: Tentar transcrição direta com Whisper
    print(f"\n🎤 === TENTATIVA 1: TRANSCRIÇÃO DIRETA ===")
    resultado = transcrever_com_whisper(arquivo_original, "base")

    if resultado and resultado.get('text'):
        texto = resultado['text']
        salvar_transcricao(texto, arquivo_original, "whisper_direto", resultado)
        return True

    # Etapa 3: Converter para formato válido
    print(f"\n🔄 === TENTATIVA 2: CONVERSÃO + TRANSCRIÇÃO ===")
    arquivo_convertido = converter_para_audio_valido(arquivo_original)

    if arquivo_convertido:
        resultado = transcrever_com_whisper(arquivo_convertido, "base")

        if resultado and resultado.get('text'):
            texto = resultado['text']
            salvar_transcricao(texto, arquivo_original, "whisper_convertido", resultado)

            # Limpar arquivo temporário
            try:
                os.remove(arquivo_convertido)
            except:
                pass
            return True

    # Etapa 4: Tentar com modelo maior
    print(f"\n🚀 === TENTATIVA 3: MODELO MAIOR ===")
    resultado = transcrever_com_whisper(arquivo_original, "small")

    if resultado and resultado.get('text'):
        texto = resultado['text']
        salvar_transcricao(texto, arquivo_original, "whisper_small", resultado)
        return True

    # Falha total
    print(f"\n❌ === FALHA NA TRANSCRIÇÃO ===")
    print("Não foi possível transcrever o áudio com nenhuma abordagem.")
    return False

def main():
    """
    Função principal - processa todos os arquivos de áudio encontrados
    """
    print("🎯 === TRANSCRITOR WHISPER DE ÁUDIO WHATSAPP ===")
    print("🔄 === PROCESSAMENTO EM LOTE ===")
    print("=" * 80)

    # Encontrar todos os arquivos de áudio
    arquivos_audio = encontrar_arquivos_audio(".")

    if not arquivos_audio:
        print("❌ Nenhum arquivo de áudio encontrado!")
        print("\n💡 FORMATOS SUPORTADOS:")
        print("   .opus, .mp3, .wav, .m4a, .ogg, .flac, .aac, .wma, .mp4, .avi, .mov")
        return

    # Estatísticas
    sucessos = 0
    falhas = 0

    # Processar cada arquivo
    for i, arquivo in enumerate(arquivos_audio, 1):
        print(f"\n🎯 ARQUIVO {i}/{len(arquivos_audio)}")

        try:
            if processar_arquivo_unico(arquivo):
                sucessos += 1
                print(f"✅ Sucesso: {arquivo}")
            else:
                falhas += 1
                print(f"❌ Falha: {arquivo}")

        except KeyboardInterrupt:
            print(f"\n⏹️ Processamento interrompido pelo usuário")
            break
        except Exception as e:
            falhas += 1
            print(f"❌ Erro inesperado em {arquivo}: {e}")

    # Relatório final
    print(f"\n{'='*80}")
    print(f"📊 === RELATÓRIO FINAL ===")
    print(f"{'='*80}")
    print(f"📁 Total de arquivos processados: {sucessos + falhas}")
    print(f"✅ Sucessos: {sucessos}")
    print(f"❌ Falhas: {falhas}")
    print(f"📈 Taxa de sucesso: {(sucessos/(sucessos+falhas)*100):.1f}%" if (sucessos+falhas) > 0 else "0%")

    # Criar relatório consolidado se houve sucessos
    if sucessos > 0:
        print(f"\n📋 Criando relatório consolidado...")
        relatorio = criar_relatorio_consolidado()
        if relatorio:
            print(f"📄 Relatório salvo em: {relatorio}")

    if falhas > 0:
        print(f"\n💡 SUGESTÕES PARA ARQUIVOS COM FALHA:")
        print("1. Use Google Drive (transcrição automática)")
        print("2. Use Microsoft OneNote (transcrição de áudio)")
        print("3. Use ferramentas online de conversão")
        print("4. Verifique se os arquivos não estão corrompidos")

    print(f"\n🎉 Processamento concluído!")
    print(f"📁 Verifique os arquivos de transcrição gerados na pasta atual.")

def criar_relatorio_consolidado():
    """
    Cria um relatório consolidado com todas as transcrições encontradas
    """
    print(f"\n📋 Criando relatório consolidado...")

    # Encontrar todos os arquivos de transcrição
    arquivos_transcricao = []
    for root, _, files in os.walk("."):
        for file in files:
            if file.startswith("transcricao_") and file.endswith(".txt"):
                caminho_completo = os.path.join(root, file)
                arquivos_transcricao.append(caminho_completo)

    if not arquivos_transcricao:
        print("❌ Nenhuma transcrição encontrada para consolidar")
        return

    # Criar relatório consolidado
    arquivo_relatorio = f"relatorio_consolidado_transcricoes.txt"

    with open(arquivo_relatorio, 'w', encoding='utf-8') as f:
        f.write("📋 RELATÓRIO CONSOLIDADO DE TRANSCRIÇÕES\n")
        f.write("=" * 80 + "\n")
        f.write(f"📅 Data de criação: 2025-01-13\n")
        f.write(f"📊 Total de transcrições: {len(arquivos_transcricao)}\n")
        f.write("=" * 80 + "\n\n")

        for i, arquivo_transcricao in enumerate(arquivos_transcricao, 1):
            f.write(f"\n{'='*60}\n")
            f.write(f"📄 TRANSCRIÇÃO {i}/{len(arquivos_transcricao)}\n")
            f.write(f"📁 Arquivo: {arquivo_transcricao}\n")
            f.write(f"{'='*60}\n")

            try:
                with open(arquivo_transcricao, 'r', encoding='utf-8') as tf:
                    conteudo = tf.read()
                    f.write(conteudo)
                    f.write("\n\n")
            except Exception as e:
                f.write(f"❌ Erro ao ler arquivo: {e}\n\n")

    print(f"✅ Relatório consolidado criado: {arquivo_relatorio}")
    return arquivo_relatorio

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
        
        # Adicionar informações adicionais se disponíveis
        if resultado_completo and 'segments' in resultado_completo:
            f.write(f"\n\n📊 SEGMENTOS DETALHADOS:\n")
            f.write(f"-" * 40 + "\n")
            for i, segment in enumerate(resultado_completo['segments']):
                f.write(f"Segmento {i+1}:\n")
                f.write(f"  Início: {segment.get('start', 'N/A')}s\n")
                f.write(f"  Fim: {segment.get('end', 'N/A')}s\n")
                f.write(f"  Texto: {segment.get('text', 'N/A')}\n")
                f.write(f"  Confiança: {segment.get('avg_logprob', 'N/A')}\n")
                f.write(f"\n")
    
    print(f"\n🎉 === TRANSCRIÇÃO SALVA COM SUCESSO! ===")
    print(f"📁 Arquivo: {arquivo_saida}")
    print(f"\n📝 TEXTO TRANSCRITO:\n")
    print("-" * 60)
    print(texto)
    print("-" * 60)
    
    if resultado_completo and 'segments' in resultado_completo:
        print(f"\n📊 Total de segmentos: {len(resultado_completo['segments'])}")
        print(f"⏱️ Duração total: {resultado_completo.get('duration', 'N/A')}s")

if __name__ == "__main__":
    main()
