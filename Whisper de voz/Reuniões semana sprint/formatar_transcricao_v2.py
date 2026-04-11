#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para formatar a transcrição com parágrafos agrupados logicamente
"""

import re

def formatar_texto_inteligente(texto):
    """
    Formata o texto agrupando frases relacionadas em parágrafos
    """
    # Dividir em sentenças (pontos finais, interrogações, exclamações)
    sentencas = re.split(r'([.!?]+)', texto)
    
    # Reagrupar sentenças com seus marcadores
    sentencas_completas = []
    for i in range(0, len(sentencas) - 1, 2):
        if i + 1 < len(sentencas):
            sentenca = sentencas[i].strip() + sentencas[i + 1]
            if sentenca.strip():
                sentencas_completas.append(sentenca.strip())
    
    # Agrupar sentenças em parágrafos
    paragrafos = []
    paragrafo_atual = []
    
    for sentenca in sentencas_completas:
        sentenca = sentenca.strip()
        if not sentenca:
            continue
            
        # Adicionar à lista atual
        paragrafo_atual.append(sentenca)
        
        # Decidir quando quebrar parágrafo:
        # 1. Se a sentença termina com "né?", "tá?", "sabe?", "entendeu?" e a próxima começa com maiúscula
        # 2. Se a sentença é muito longa (mais de 200 caracteres)
        # 3. Se há mudança de tópico (palavras-chave)
        
        quebrar_paragrafo = False
        
        # Verificar se termina com interrogação curta
        if re.search(r'(né\?|tá\?|sabe\?|entendeu\?|ok\?)$', sentenca, re.IGNORECASE):
            quebrar_paragrafo = True
        
        # Verificar se é muito longa
        if len(sentenca) > 200:
            quebrar_paragrafo = True
        
        # Verificar mudança de tópico
        palavras_topicos = ['então', 'porque', 'mas', 'daí', 'aí', 'por isso', 'assim', 
                           'por exemplo', 'agora', 'depois', 'antes', 'então assim',
                           'vou mostrar', 'deixa eu', 'olha', 'veja', 'sabe o que']
        if any(sentenca.lower().startswith(palavra) for palavra in palavras_topicos):
            if len(paragrafo_atual) > 1:  # Só quebrar se já tiver conteúdo
                quebrar_paragrafo = True
        
        # Se deve quebrar, salvar parágrafo atual e começar novo
        if quebrar_paragrafo and len(paragrafo_atual) > 0:
            paragrafos.append(' '.join(paragrafo_atual))
            paragrafo_atual = []
    
    # Adicionar último parágrafo se houver
    if paragrafo_atual:
        paragrafos.append(' '.join(paragrafo_atual))
    
    # Juntar parágrafos com quebras duplas
    return '\n\n'.join(paragrafos)

# Ler o arquivo original
arquivo_entrada = "transcricao_Reunião vini.txt"
arquivo_saida = "transcricao_Reunião vini_formatado.txt"

with open(arquivo_entrada, 'r', encoding='utf-8') as f:
    conteudo = f.read()

# Separar cabeçalho do texto
linhas = conteudo.split('\n')
cabecalho = []
texto_transcricao = []

em_texto = False
for linha in linhas:
    if linha.strip() == "" and not em_texto:
        continue
    if linha.startswith("Não, não") or em_texto:
        em_texto = True
        texto_transcricao.append(linha)
    else:
        cabecalho.append(linha)

# Juntar o texto da transcrição
texto_completo = ' '.join(texto_transcricao)

# Formatar o texto
texto_formatado = formatar_texto_inteligente(texto_completo)

# Juntar tudo
conteudo_final = '\n'.join(cabecalho) + '\n\n' + texto_formatado

# Salvar arquivo formatado
with open(arquivo_saida, 'w', encoding='utf-8') as f:
    f.write(conteudo_final)

print(f"✅ Arquivo formatado salvo em: {arquivo_saida}")
print(f"📊 Total de parágrafos: {len(texto_formatado.split(chr(10)*2))}")



