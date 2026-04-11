#!/usr/bin/env python3
"""
Script melhorado para comprimir vídeo até 32 MB mantendo qualidade
Usa H.265 (x265) com ajuste automático de resolução
"""
import subprocess
import os
import sys
import re
import time

def get_video_duration(input_file):
    """Obtém a duração do vídeo em segundos"""
    cmd = ['ffmpeg', '-i', input_file]
    result = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    
    for line in result.stderr.split('\n'):
        if 'Duration' in line:
            match = re.search(r'Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})', line)
            if match:
                h, m, s = match.groups()
                total_seconds = int(h) * 3600 + int(m) * 60 + float(s)
                return total_seconds
    return None

def compress_video(input_file, output_file, target_size_mb=32):
    """Comprime vídeo para tamanho alvo usando H.265"""
    
    print(f"{'='*60}")
    print(f"🎬 COMPRESSÃO DE VÍDEO - H.265")
    print(f"{'='*60}")
    print(f"📁 Arquivo original: {input_file}")
    
    if not os.path.exists(input_file):
        print(f"❌ Erro: Arquivo não encontrado")
        return False
    
    original_size_mb = os.path.getsize(input_file) / (1024 * 1024)
    print(f"📊 Tamanho original: {original_size_mb:.2f} MB")
    print(f"🎯 Tamanho alvo: {target_size_mb} MB")
    print(f"📉 Redução necessária: {((1 - target_size_mb/original_size_mb) * 100):.1f}%")
    
    print(f"\n🔍 Analisando vídeo...")
    duration = get_video_duration(input_file)
    
    if not duration:
        print("❌ Erro: Não foi possível determinar a duração")
        return False
    
    print(f"   ⏱️  Duração: {int(duration//60)}m {int(duration%60)}s ({duration:.2f}s)")
    
    # Calcula bitrate necessário
    target_video_bitrate = int((target_size_mb * 8192) / duration - 128)
    
    if target_video_bitrate < 500:
        target_video_bitrate = 500
        print(f"   ⚠️  Bitrate ajustado para mínimo: 500 kbps")
    
    print(f"\n⚙️  Configuração:")
    print(f"   Codec: H.265 (x265) - melhor compressão")
    print(f"   Resolução: 1920x1080 (Full HD)")
    print(f"   Bitrate vídeo: {target_video_bitrate} kbps")
    print(f"   Bitrate áudio: 128 kbps AAC")
    print(f"   Preset: medium")
    
    print(f"\n🔄 Iniciando compressão...")
    print(f"   (Isso pode levar 2-5 minutos dependendo do hardware)")
    print()
    
    # Comando FFmpeg otimizado
    cmd = [
        'ffmpeg',
        '-i', input_file,
        '-vf', 'scale=1920:1080',      # Reduz para 1080p
        '-c:v', 'libx265',              # Codec H.265
        '-b:v', f'{target_video_bitrate}k',
        '-preset', 'medium',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        output_file
    ]
    
    try:
        # Executa com output em tempo real
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        last_progress = 0
        start_time = time.time()
        
        # Monitora progresso
        for line in process.stdout:
            if 'time=' in line:
                match = re.search(r'time=(\d{2}):(\d{2}):(\d{2}\.\d{2})', line)
                if match:
                    h, m, s = match.groups()
                    elapsed = int(h) * 3600 + int(m) * 60 + float(s)
                    progress = min(100, (elapsed / duration) * 100)
                    
                    if progress - last_progress >= 5:  # Atualiza a cada 5%
                        elapsed_time = time.time() - start_time
                        eta = (elapsed_time / progress * 100) - elapsed_time if progress > 0 else 0
                        print(f"   ⏳ {progress:.0f}% | Tempo: {int(elapsed_time)}s | ETA: {int(eta)}s", flush=True)
                        last_progress = progress
        
        process.wait()
        
        if process.returncode != 0:
            print(f"\n❌ Erro na compressão (código: {process.returncode})")
            return False
        
        # Verifica resultado
        if os.path.exists(output_file):
            final_size_mb = os.path.getsize(output_file) / (1024 * 1024)
            reduction = ((original_size_mb - final_size_mb) / original_size_mb) * 100
            
            print(f"\n{'='*60}")
            print(f"✅ COMPRESSÃO CONCLUÍDA!")
            print(f"{'='*60}")
            print(f"📊 Tamanho original: {original_size_mb:.2f} MB")
            print(f"📊 Tamanho final: {final_size_mb:.2f} MB")
            print(f"📉 Redução: {reduction:.1f}%")
            print(f"📁 Arquivo: {output_file}")
            
            if final_size_mb <= target_size_mb * 1.1:
                print(f"✅ Meta atingida! (alvo: {target_size_mb} MB)")
            else:
                print(f"⚠️  {final_size_mb - target_size_mb:.2f} MB acima do alvo")
            
            print(f"{'='*60}")
            return True
        else:
            print(f"\n❌ Arquivo de saída não foi criado")
            return False
            
    except Exception as e:
        print(f"\n❌ Erro: {e}")
        return False

if __name__ == "__main__":
    input_video = "APRESENTAÇÃO PAPA E BOB (2).mp4"
    target_mb = 32
    output_video = "APRESENTAÇÃO PAPA E BOB (2)_32MB.mp4"
    
    if not os.path.exists(input_video):
        print(f"❌ Arquivo {input_video} não encontrado")
        sys.exit(1)
    
    success = compress_video(input_video, output_video, target_mb)
    sys.exit(0 if success else 1)

