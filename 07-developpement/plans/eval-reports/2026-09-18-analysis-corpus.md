# Évaluation du corpus d'analyse — 2026-09-18

Modèle : `claude-sonnet-5` · 15 courriers · latence médiane 17220 ms

| Métrique | Valeur |
|---|---|
| Réponses conformes au schéma | 100.0 % |
| Organisme correct | 100.0 % |
| Date du courrier correcte | 100.0 % |
| Rappel actions (extrait seul) | 92.9 % |
| Rappel actions (extrait ou titre) | 92.9 % |
| Actions non ancrées | 0.0 % |
| Rappel justificatifs | 100.0 % |
| Justificatifs non ancrés | 0.0 % |
| Informations non ancrées | 0.0 % |

Deux rappels d'actions sont publiés. Le strict exige que l'extrait du dataset et
celui du modèle se recouvrent ; il sous-estime le rappel réel, parce que le
dataset et le modèle peuvent ancrer la même consigne sur deux phrases
différentes du courrier. Le souple accepte en repli un recouvrement de mots
significatifs entre titres. Le détail par courrier ci-dessous utilise le souple.

« Non ancré » = `sourceExcerpt` absent du texte extrait du PDF. C'est le seul
indicateur objectif d'invention, et il ne dépend d'aucun appariement. « Hors référentiel » (ancré mais absent du
dataset) est consultable par courrier dans le JSON et n'est pas un défaut : le
dataset peut être incomplet.

| Courrier | Schéma | Organisme | Date | Actions ok/manqué/non ancré | Justificatifs ok/manqué/non ancré |
|---|---|---|---|---|---|
| CAF-01 | ok | ok | ok | 0/1/0 | 2/0/0 |
| CAF-02 | ok | ok | ok | 1/0/0 | 1/0/0 |
| CAF-03 | ok | ok | ok | 1/0/0 | 1/0/0 |
| CAF-04 | ok | ok | ok | 1/0/0 | 1/0/0 |
| CAF-05 | ok | ok | ok | 1/0/0 | 0/0/0 |
| CPAM-01 | ok | ok | ok | 1/0/0 | 1/0/0 |
| CPAM-02 | ok | ok | ok | 1/0/0 | 1/0/0 |
| CPAM-03 | ok | ok | ok | 1/0/0 | 1/0/0 |
| CPAM-04 | ok | ok | ok | 1/0/0 | 1/0/0 |
| CPAM-05 | ok | ok | ok | 0/0/0 | 0/0/0 |
| FT-01 | ok | ok | ok | 1/0/0 | 0/0/0 |
| FT-02 | ok | ok | ok | 1/0/0 | 2/0/0 |
| FT-03 | ok | ok | ok | 1/0/0 | 1/0/0 |
| FT-04 | ok | ok | ok | 1/0/0 | 0/0/0 |
| FT-05 | ok | ok | ok | 1/0/0 | 0/0/0 |
