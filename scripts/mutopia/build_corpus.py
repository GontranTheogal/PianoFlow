#!/usr/bin/env python3
"""Corpus de doigtés tiré du Mutopia Project (partitions LilyPond libres), pour scripts/train-fingering.ts.

  python3 scripts/mutopia/build_corpus.py corpus <dossier Mutopia> <dossier de sortie> [--min 10] [--jobs 4]
      repère les pièces pour clavier qui contiennent au moins --min doigtés écrits, en extrait les notes avec LilyPond,
      puis écrit un fichier PIG par pièce (format lu par scripts/train-fingering.ts).
  python3 scripts/mutopia/build_corpus.py extract <dossier d'une pièce> <sortie.tsv>
      extrait les notes d'une seule pièce (TSV décrit en tête de dump.ly), par exemple pour transcrire un morceau.

Le dossier Mutopia est une copie des sources du dépôt github.com/MutopiaProject/MutopiaProject (seuls les .ly/.ily servent) :
  git clone --filter=blob:none --no-checkout --depth 1 https://github.com/MutopiaProject/MutopiaProject mutopia
  cd mutopia && git sparse-checkout set --no-cone '/ftp/**/*.ly' '/ftp/**/*.ily' '/ftp/**/*.lyi' && git checkout
LilyPond 2.24 ou plus récent est nécessaire (`python3 -m pip install lilypond` en fournit un ; sinon variable LILYPOND_BIN).

Choix faits pour l'entraînement : la main est la portée où la voix a été créée (0 = main droite, 1 = main gauche), même si la voix
passe ensuite sur l'autre portée ; seules les partitions à deux portées sont gardées (les pièces à quatre mains sont écrites en
partitions séparées pour primo et secondo) ; une note liée à la suivante ne compte qu'une fois ; les petites notes sont ignorées ;
la passe de mise en page (reprises écrites une fois) est préférée à la passe MIDI.
"""
import collections, concurrent.futures as cf, glob, os, re, shutil, subprocess, sys, tempfile
from fractions import Fraction as F

HERE = os.path.dirname(os.path.abspath(__file__))
DUMP = os.path.join(HERE, "dump.ly")
KEYBOARD = re.compile(r"piano|harpsichord|clavichord|clavier|cembalo|pianoforte", re.I)
NOT_SOLO = re.compile(r"violin|viola|cello|flute|voice|voix|orgue|organ|guitar", re.I)
FINGERED_NOTE = re.compile(r"(?<![\\a-zA-Z])[a-g](?:is|es|s)*[',]*\d*\.*~?(?:\s*[-_^](?:[1-5]|\"[^\"]*\"|\.|>|-|\^|_|!))*\s*[-_^][1-5](?![0-9])")


def bin_dir():
    if os.environ.get("LILYPOND_BIN"):
        return os.environ["LILYPOND_BIN"]
    try:
        import lilypond  # paquet pip « lilypond »
        return os.path.dirname(str(lilypond.executable()))
    except Exception:
        found = shutil.which("lilypond")
        if not found:
            sys.exit("LilyPond introuvable : python3 -m pip install lilypond, ou LILYPOND_BIN=/chemin/vers/bin")
        return os.path.dirname(found)


def piece_dirs(root):
    """Dossier d'une pièce = dossier de ses .ly (le sous-dossier « …-lys » remonte d'un cran)."""
    seen = collections.OrderedDict()
    for path in sorted(glob.glob(os.path.join(root, "ftp", "**", "*.ly"), recursive=True)):
        d = os.path.dirname(path)
        while os.path.basename(d).endswith("-lys") or os.path.basename(d) == "ilys":
            d = os.path.dirname(d)
        seen.setdefault(d, []).append(path)
    return seen


def scan(root, minimum):
    out = []
    for d in piece_dirs(root):
        text, inst = "", ""
        for f in glob.glob(os.path.join(d, "**", "*.*ly*"), recursive=True):
            t = open(f, encoding="utf-8", errors="ignore").read()
            m = re.search(r'instrument\s*=\s*"([^"]*)"', t)
            if m and not inst:
                inst = m.group(1)
            text += re.sub(r"%[^\n]*", "", re.sub(r"%\{.*?%\}", "", t, flags=re.S))
        if not KEYBOARD.search(inst) or NOT_SOLO.search(inst):
            continue
        n = len(FINGERED_NOTE.findall(text))
        if n >= minimum:
            out.append((d, n, inst))
    return out


def extract(piece, out_tsv, lily=None):
    """Copie la pièce, met sa syntaxe à jour (convert-ly), lance LilyPond avec dump.ly ; renvoie le nombre de lignes de notes."""
    lily = lily or bin_dir()
    work = tempfile.mkdtemp(prefix="mutopia-")
    try:
        shutil.copytree(piece, work, dirs_exist_ok=True)
        files = [os.path.join(r, f) for r, _, fs in os.walk(work) for f in fs if f.endswith((".ly", ".ily", ".lyi"))]
        for f in files:
            subprocess.run([os.path.join(lily, "convert-ly"), "-e", f], capture_output=True)
            t = open(f, encoding="utf-8", errors="ignore").read()
            t2 = t.replace("\\applyMusic #unfold-repeats", "\\unfoldRepeats")   # ancienne écriture que convert-ly ne traduit pas
            if t2 != t:
                open(f, "w", encoding="utf-8").write(t2)
        mains = [f for f in files if f.endswith(".ly") and re.search(r"^\s*\\(score|book|bookpart)\b", open(f, encoding="utf-8", errors="ignore").read(), re.M)]
        mains = mains or [f for f in files if f.endswith(".ly")]
        lines = []
        for m in sorted(mains):
            part = os.path.join(work, "dump.part")
            env = dict(os.environ, DUMP_OUT=part)
            try:
                subprocess.run([os.path.join(lily, "lilypond"), "-dinclude-settings=" + DUMP, "-dno-print-pages", "-l", "ERROR", os.path.basename(m)],
                               cwd=os.path.dirname(m), env=env, capture_output=True, timeout=300)
            except subprocess.TimeoutExpired:
                pass
            if os.path.exists(part):
                name = os.path.splitext(os.path.basename(m))[0]
                for l in open(part, encoding="utf-8", errors="ignore"):
                    if l.endswith("\n"):   # une ligne coupée (LilyPond arrêté en cours de route) est ignorée
                        lines.append(name + "\t" + l)
                os.remove(part)
        with open(out_tsv, "w", encoding="utf-8") as o:
            o.writelines(lines)
        return sum(1 for l in lines if "\tN\t" in l)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def finger(s):
    m = re.search(r"[1-5]", s) if s != "_" else None
    return int(m.group(0)) if m else None


def to_pig(tsv, out_txt):
    """TSV d'une pièce -> fichier PIG (une ligne par note : id, attaque, fin, hauteur, vélocités, canal 0 = droite / 1 = gauche, doigt)."""
    rows = [c for c in (l.rstrip("\n").split("\t") for l in open(tsv, encoding="utf-8", errors="ignore"))
            if len(c) == 19 and c[1] == "N" and c[3].isdigit() and c[5].lstrip("-").isdigit()]
    groups = collections.defaultdict(list)
    for c in rows:
        groups[(c[0], c[2], int(c[3]))].append(c)
    has_layout = any(mode == "L" for (_, mode, _) in groups)
    lines, t0, fingered = [], F(0), 0
    for (_, mode, _), g in sorted(groups.items()):
        if mode == "M" and has_layout:
            continue
        if {int(c[4]) for c in g} != {0, 1}:
            continue
        notes = [dict(hand="R" if c[5] == "0" else "L", voice=c[6], on=F(c[7]), dur=F(c[8]), midi=int(c[10]), name=c[11], tie=c[12] == "1", f=finger(c[13]))
                 for c in g if c[9] != "1"]
        by_voice = collections.defaultdict(list)
        for n in notes:
            by_voice[n["voice"]].append(n)
        keep = []
        for ns in by_voice.values():
            ns.sort(key=lambda n: (n["on"], n["midi"]))
            at = collections.defaultdict(list)
            for n in ns:
                at[(n["on"], n["midi"])].append(n)
            dead = set()
            for n in ns:
                if id(n) in dead:
                    continue
                cur = n
                while cur["tie"]:
                    nxt = [m for m in at.get((cur["on"] + cur["dur"], cur["midi"]), []) if id(m) not in dead and m is not cur]
                    if not nxt:
                        break
                    dead.add(id(nxt[0]))
                    n["dur"] += nxt[0]["dur"]
                    n["f"] = n["f"] or nxt[0]["f"]
                    cur = nxt[0]
                keep.append(n)
            keep = [n for n in keep if id(n) not in dead]
        if not keep:
            continue
        for n in sorted(keep, key=lambda n: (n["on"], n["midi"])):
            on = (t0 + n["on"]) * 2   # une blanche = 1 s
            f = "_" if n["f"] is None else str(n["f"] if n["hand"] == "R" else -n["f"])
            lines.append(f"{float(on):.6f}\t{float(on + n['dur'] * 2):.6f}\t{n['name']}\t64\t80\t{0 if n['hand'] == 'R' else 1}\t{f}")
            fingered += n["f"] is not None
        t0 += max(n["on"] + n["dur"] for n in keep) + 4
    if not lines:
        return 0, 0
    with open(out_txt, "w") as o:
        o.write("//Version: PianoFingering_v170101\n")
        o.writelines(f"{i}\t{l}\n" for i, l in enumerate(lines))
    return len(lines), fingered


def main():
    a = sys.argv[1:]
    if len(a) >= 3 and a[0] == "extract":
        print(f"{extract(a[1], a[2])} notes -> {a[2]}")
    elif len(a) >= 3 and a[0] == "corpus":
        root, out = a[1], a[2]
        minimum = int(a[a.index("--min") + 1]) if "--min" in a else 10
        jobs = int(a[a.index("--jobs") + 1]) if "--jobs" in a else 4
        os.makedirs(out, exist_ok=True)
        tsv_dir = tempfile.mkdtemp(prefix="mutopia-tsv-")
        pieces = scan(root, minimum)
        print(f"{len(pieces)} pièces pour clavier avec au moins {minimum} doigtés écrits")
        lily = bin_dir()
        names = {d: os.path.relpath(d, root).replace(os.sep, "_") for d, _, _ in pieces}
        with cf.ThreadPoolExecutor(jobs) as ex:
            futs = {ex.submit(extract, d, os.path.join(tsv_dir, names[d] + ".tsv"), lily): d for d, _, _ in pieces}
            for fu in cf.as_completed(futs):
                if not fu.result():
                    print("  échec :", os.path.relpath(futs[fu], root))
        total = fing = files = 0
        for d, _, _ in pieces:
            tsv = os.path.join(tsv_dir, names[d] + ".tsv")
            if os.path.exists(tsv):
                n, f = to_pig(tsv, os.path.join(out, names[d] + ".txt"))
                files += n > 0; total += n; fing += f
        shutil.rmtree(tsv_dir, ignore_errors=True)
        print(f"{files} fichiers écrits dans {out} : {total} notes, dont {fing} doigtées")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
