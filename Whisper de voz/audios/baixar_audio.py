"""
Script para baixar áudio de um vídeo do YouTube e converter para MP3.

Pré-requisitos:
1) Instalar yt-dlp:
   pip install yt-dlp
2) Ter ffmpeg instalado e no PATH (necessário para converter para mp3).

Uso:
   python baixar_audio.py

O script baixa o melhor áudio disponível e grava em ./audios
com nome: <titulo> [<video_id>].mp3
"""

from pathlib import Path
import yt_dlp


def baixar_audio(video_url: str, pasta_saida: str = "audios") -> Path:
    """
    Baixa apenas o áudio de um vídeo do YouTube e salva em MP3.

    :param video_url: URL completa do vídeo (watch, youtu.be, live, etc).
    :param pasta_saida: Pasta onde o arquivo de áudio será salvo.
    :return: Caminho completo do arquivo de áudio gerado.
    """
    out_dir = Path(pasta_saida)
    out_dir.mkdir(parents=True, exist_ok=True)

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(out_dir / "%(title)s [%(id)s].%(ext)s"),
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "quiet": False,
        "noprogress": False,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=True)
        titulo = info.get("title", "audio")
        video_id = info.get("id", "id")
        nome_arquivo = f"{titulo} [{video_id}].mp3"
        caminho_final = out_dir / nome_arquivo
        return caminho_final


if __name__ == "__main__":
    # Substitua pela URL desejada (já aponta para a live enviada)
    url = "https://www.youtube.com/watch?v=_A_JefaV3WI"
    destino = baixar_audio(url)
    print(f"Áudio salvo em:\n{destino}")

