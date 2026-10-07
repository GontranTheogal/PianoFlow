%% Extraction des notes d'une partition LilyPond (Mutopia) : une ligne par note (hauteur, attaque, durée, portée, voix, liaison,
%% doigté écrit, mesure, chiffrage, armure) dans le fichier TSV désigné par $DUMP_OUT. Utilisé par build_corpus.py :
%%   DUMP_OUT=sortie.tsv lilypond -dinclude-settings=dump.ly -dno-print-pages morceau.ly
%% Passe « L » (mise en page) : reprises écrites une fois ; passe « M » (MIDI) : ce que joue la partition \midi (souvent dépliée).
%% Colonnes : N, mode, partition, portée, portée d'origine de la voix (= main), voix, attaque, durée (en rondes), petite note,
%% MIDI, nom, liaison, doigts, mesure, position dans la mesure, chiffrage, armure. Lignes D : nuances.

#(define dump-port #f)
#(define (dump-out)
   (or dump-port
       (begin
        (set! dump-port (open-file (or (getenv "DUMP_OUT") "dump.tsv") "a"))
        dump-port)))
#(define score-count 0)
#(define staff-count 0)
#(define staff-index (make-hash-table))
#(define voice-count 0)
#(define voice-index (make-hash-table))
#(define voice-home (make-hash-table))

#(define (rat->string r) (format #f "~a/~a" (numerator r) (denominator r)))
#(define (mom->string m) (rat->string (ly:moment-main m)))
#(define (pitch-name p)
   (let* ((names #("C" "D" "E" "F" "G" "A" "B"))
          (alt (ly:pitch-alteration p))
          (acc (cond ((= alt 1) "##") ((= alt 1/2) "#") ((= alt -1/2) "b") ((= alt -1) "bb") (else ""))))
     (format #f "~a~a~a" (vector-ref names (ly:pitch-notename p)) acc (+ 4 (ly:pitch-octave p)))))
#(define (key-fifths ctx)
   (let ((alts (ly:context-property ctx 'keyAlterations '())))
     (if (not (list? alts)) 0
         (apply + (map (lambda (e)
                         (let ((a (if (pair? e) (cdr e) 0)))
                           (cond ((and (number? a) (> a 0)) 1) ((and (number? a) (< a 0)) -1) (else 0))))
                       alts)))))
#(define (staff-of ctx)
   (let ((st (ly:context-find ctx 'Staff)))
     (if st (hashq-ref staff-index st -1) -1)))
#(define (voice-of ctx)
   (or (hashq-ref voice-index ctx #f)
       (begin (set! voice-count (1+ voice-count))
              (hashq-set! voice-index ctx voice-count)
              voice-count)))

#(define (note-data ctx ev)
   ;; returns a list (fields-before-tie fingers tie) or #f; fingers / tie from the event's own articulations
   (let* ((p (ly:event-property ev 'pitch #f))
          (d (ly:event-property ev 'duration #f)))
     (and (ly:pitch? p) (ly:duration? d)
          (let* ((sidx (staff-of ctx))
                 (vidx (voice-of ctx))
                 (home (or (hashq-ref voice-home ctx #f) (begin (hashq-set! voice-home ctx sidx) sidx)))
                 (mom (ly:context-current-moment ctx))
                 (grace (if (zero? (ly:moment-grace mom)) 0 1))
                 (arts (ly:event-property ev 'articulations '()))
                 (fingers (filter-map finger-of arts))
                 (tie (any (lambda (a) (ly:in-event-class? a 'tie-event)) arts))
                 (tsf (ly:context-property ctx 'timeSignatureFraction '(4 . 4)))
                 (mp (ly:context-property ctx 'measurePosition (ly:make-moment 0)))
                 (bar (ly:context-property ctx 'currentBarNumber 0)))
            (list (list score-count sidx home vidx
                        (mom->string mom) (rat->string (ly:moment-main (ly:duration-length d))) grace
                        (+ 60 (ly:pitch-semitones p)) (pitch-name p))
                  fingers tie
                  (list bar (if (ly:moment? mp) (mom->string mp) "0/1")
                        (format #f "~a/~a" (if (pair? tsf) (car tsf) 4) (if (pair? tsf) (cdr tsf) 4))
                        (key-fifths ctx)))))))
#(define (finger-of a)
   (and (ly:in-event-class? a 'fingering-event)
        (let ((dg (ly:event-property a 'digit #f))
              (tx (ly:event-property a 'text #f)))
          (cond ((integer? dg) (number->string dg))
                ((string? tx) tx)
                (else #f)))))
#(define (emit-notes mode pending sep-fingers sep-tie)
   ;; pending: note-data items heard in this timestep (one voice). Separately broadcast fingerings belong to a lone note.
   (let ((lone (= (length pending) 1)))
     (for-each
      (lambda (nd)
        (let* ((fingers (if (and lone (null? (cadr nd))) sep-fingers (cadr nd)))
               (tie (or (caddr nd) sep-tie)))
          (format (dump-out) "N\t~a\t~a\t~a\t~a\t~a\t~a\n"
                  mode (string-join (map (lambda (x) (format #f "~a" x)) (car nd)) "\t")
                  (if tie 1 0)
                  (if (null? fingers) "_" (string-join fingers ","))
                  (string-join (map (lambda (x) (format #f "~a" x)) (cadddr nd)) "\t")
                  "")))
      (reverse pending))
     (force-output (dump-out))))

#(define (dyn-line mode ctx ev)
   (let ((tx (ly:event-property ev 'text #f)))
     (if (string? tx)
         (format (dump-out) "D\t~a\t~a\t~a\t~a\t~a\t~s\n" mode score-count (staff-of ctx) (voice-of ctx)
                 (mom->string (ly:context-current-moment ctx)) tx))))

#(define (Dump_score_engraver ctx)
   (make-engraver ((initialize t) (set! score-count (1+ score-count)) (set! staff-count 0))))
#(define (Dump_staff_engraver ctx)
   (make-engraver ((initialize t) (hashq-set! staff-index ctx staff-count) (set! staff-count (1+ staff-count)))))
#(define-macro (voice-dumper maker mode)
   `(lambda (ctx)
      (let ((pending '()) (sep-fingers '()) (sep-tie #f))
        (,maker
         ((initialize t) (hashq-set! voice-home ctx (staff-of ctx)))   ; la main = la portée où la voix a été créée
         (listeners
          ((note-event t ev) (let ((nd (note-data ctx ev))) (if nd (set! pending (cons nd pending)))))
          ((fingering-event t ev) (let ((f (finger-of ev))) (if f (set! sep-fingers (append sep-fingers (list f))))))
          ((tie-event t ev) (set! sep-tie #t))
          ((absolute-dynamic-event t ev) (dyn-line ,mode ctx ev)))
         ((process-music t)
          (if (pair? pending) (emit-notes ,mode pending sep-fingers sep-tie))
          (set! pending '()) (set! sep-fingers '()) (set! sep-tie #f))))))
#(define Dump_voice_engraver (voice-dumper make-engraver "L"))
#(define (Dump_score_performer ctx)
   (make-performer ((initialize t) (set! score-count (1+ score-count)) (set! staff-count 0))))
#(define (Dump_staff_performer ctx)
   (make-performer ((initialize t) (hashq-set! staff-index ctx staff-count) (set! staff-count (1+ staff-count)))))
#(define Dump_voice_performer (voice-dumper make-performer "M"))

\layout {
  \context { \Score \consists #Dump_score_engraver }
  \context { \Staff \consists #Dump_staff_engraver }
  \context { \Voice \consists #Dump_voice_engraver }
}
\midi {
  \context { \Score \consists #Dump_score_performer }
  \context { \Staff \consists #Dump_staff_performer }
  \context { \Voice \consists #Dump_voice_performer }
}
