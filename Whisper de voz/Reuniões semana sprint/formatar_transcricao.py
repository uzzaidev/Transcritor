#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para formatar a transcrição, adicionando quebras de linha e parágrafos
"""

import re

def formatar_texto(texto):
    """
    Formata o texto adicionando quebras de linha após pontos finais,
    interrogações e exclamações, melhorando a legibilidade
    """
    # Primeiro, vamos dividir o texto em sentenças
    # Adicionar quebra após pontos finais, interrogações e exclamações
    texto = re.sub(r'([.!?])\s+', r'\1\n\n', texto)
    
    # Adicionar quebra após vírgulas seguidas de palavras longas (mais de 10 caracteres)
    # Mas apenas se não for uma enumeração curta
    texto = re.sub(r',\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{10,})', r',\n\1', texto)
    
    # Adicionar quebra após "né?", "tá?", "sabe?", etc
    texto = re.sub(r'(né\?|tá\?|sabe\?|entendeu\?)\s+', r'\1\n\n', texto)
    
    # Adicionar quebra após "Então", "Porque", "Mas", "E", "Mas" no início de frase
    texto = re.sub(r'\n\n(Então|Porque|Mas|E|Mas|Daí|Aí|Por isso|Assim|Por exemplo|Porém|No entanto|Além disso|Também|Além do mais|Por outro lado|Contudo|Todavia|Ademais|Outrossim|Igualmente|Similarmente|Analogamente|Consequentemente|Portanto|Logo|Assim sendo|Dessa forma|Desse modo|Nesse sentido|Nessa perspectiva|Nessa linha|Nessa direção|Nesse contexto|Nessa situação|Nesse caso|Nessa ocasião|Nessa oportunidade|Nessa circunstância|Nessa condição|Nessa hipótese|Nessa eventualidade|Nessa possibilidade|Nessa perspectiva|Nessa visão|Nessa ótica|Nessa abordagem|Nessa análise|Nessa avaliação|Nessa consideração|Nessa reflexão|Nessa ponderação|Nessa deliberação|Nessa decisão|Nessa escolha|Nessa opção|Nessa alternativa|Nessa solução|Nessa resposta|Nessa reação|Nessa atitude|Nessa postura|Nessa posição|Nessa situação|Nessa condição|Nessa circunstância|Nessa ocasião|Nessa oportunidade|Nessa chance|Nessa possibilidade|Nessa eventualidade|Nessa hipótese|Nessa perspectiva|Nessa visão|Nessa ótica|Nessa abordagem|Nessa análise|Nessa avaliação|Nessa consideração|Nessa reflexão|Nessa ponderação|Nessa deliberação|Nessa decisão|Nessa escolha|Nessa opção|Nessa alternativa|Nessa solução|Nessa resposta|Nessa reação|Nessa atitude|Nessa postura|Nessa posição)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ])', r'\n\n\1 \2', texto)
    
    # Limpar múltiplas quebras de linha (mais de 2)
    texto = re.sub(r'\n{3,}', r'\n\n', texto)
    
    # Remover espaços no início de linhas
    texto = re.sub(r'\n +', r'\n', texto)
    
    return texto

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
texto_completo = '\n'.join(texto_transcricao)

# Formatar o texto
texto_formatado = formatar_texto(texto_completo)

# Juntar tudo
conteudo_final = '\n'.join(cabecalho) + '\n\n' + texto_formatado

# Salvar arquivo formatado
with open(arquivo_saida, 'w', encoding='utf-8') as f:
    f.write(conteudo_final)

print(f"✅ Arquivo formatado salvo em: {arquivo_saida}")



