import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { colors, styles } from '../theme';

// Backup check: the user taps the words of their recovery phrase in the
// correct order, choosing from a shuffled grid. Proves the phrase was
// actually written down (and written down correctly) before proceeding.
// Duplicate words are interchangeable — any unused chip with the right
// word counts.
export default function WordConfirm({
  phrase,
  hint,
  wrongText,
  doneText,
  buttonLabel,
  onDone,
}: {
  phrase: string;
  hint: string;
  wrongText: string;
  doneText: string;
  buttonLabel: string;
  onDone: () => void;
}) {
  const words = useMemo(() => phrase.trim().split(/\s+/), [phrase]);
  const chips = useMemo(() => {
    const arr = words.map((w, i) => ({ id: i, word: w }));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [words]);
  const [used, setUsed] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);
  const [wrong, setWrong] = useState(false);

  const done = progress >= words.length;

  const tap = (chip: { id: number; word: string }) => {
    if (done || used.has(chip.id)) return;
    if (chip.word === words[progress]) {
      const next = new Set(used);
      next.add(chip.id);
      setUsed(next);
      setProgress(progress + 1);
      setWrong(false);
    } else {
      setUsed(new Set());
      setProgress(0);
      setWrong(true);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.sub}>{hint}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {words.slice(0, progress).map((w, i) => (
          <View
            key={i}
            style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}
          >
            <Text style={{ color: '#fff', fontSize: 13 }}>
              {i + 1}. {w}
            </Text>
          </View>
        ))}
        {done && <Text style={[styles.body, { color: colors.accent }]}>{doneText}</Text>}
      </View>
      {wrong && <Text style={[styles.body, { color: colors.danger }]}>{wrongText}</Text>}
      {!done && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((chip) => {
            const isUsed = used.has(chip.id);
            return (
              <TouchableOpacity
                key={chip.id}
                disabled={isUsed}
                onPress={() => tap(chip)}
                style={{
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  opacity: isUsed ? 0.25 : 1,
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ fontSize: 14, color: colors.ink }}>{chip.word}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {done && (
        <TouchableOpacity style={styles.button} onPress={onDone}>
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
