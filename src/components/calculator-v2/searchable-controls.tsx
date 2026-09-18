"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./calculator-v2.module.css";

export interface SearchableOption {
  value: string;
  label: string;
  meta?: string;
  searchText?: string;
}

interface SearchableComboboxProps {
  value: string;
  options: SearchableOption[];
  placeholder?: string;
  emptyLabel?: string;
  maxResults?: number;
  onChange: (value: string) => void;
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function optionMatches(option: SearchableOption, query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  const haystack = normalize(
    [option.label, option.meta, option.value, option.searchText]
      .filter(Boolean)
      .join(" "),
  );
  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

export function SearchableCombobox({
  value,
  options,
  placeholder = "Search...",
  emptyLabel = "No matches",
  maxResults,
  onChange,
}: SearchableComboboxProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const [queryDraft, setQueryDraft] = useState<{
    forValue: string;
    text: string;
  } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const query =
    queryDraft?.forValue === value
      ? queryDraft.text
      : (selectedOption?.label ?? "");

  function setQuery(text: string) {
    setQueryDraft({ forValue: value, text });
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const filteredOptions = useMemo(
    () => {
      const matches = options.filter((option) => optionMatches(option, query));
      return typeof maxResults === "number"
        ? matches.slice(0, maxResults)
        : matches;
    },
    [maxResults, options, query],
  );

  return (
    <div className={styles.combo} ref={wrapperRef}>
      <input
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onBlur={() => {
          if (!query.trim()) {
            onChange("");
            return;
          }
          setQuery(selectedOption?.label ?? query);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
          if (event.key === "Enter" && filteredOptions[0]) {
            event.preventDefault();
            onChange(filteredOptions[0].value);
            setQuery(filteredOptions[0].label);
            setIsOpen(false);
          }
        }}
      />
      {query || value ? (
        <button
          aria-label="Clear search"
          className={styles.comboClear}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            setQuery("");
            onChange("");
            setIsOpen(true);
          }}
        >
          x
        </button>
      ) : null}
      {isOpen ? (
        <div className={styles.comboMenu} role="listbox">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                className={option.value === value ? styles.comboActive : undefined}
                key={option.value}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option.value);
                  setQuery(option.label);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {option.meta ? <small>{option.meta}</small> : null}
              </button>
            ))
          ) : (
            <div className={styles.comboEmpty}>{emptyLabel}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface NumericComboboxProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

export function NumericCombobox({
  value,
  min,
  max,
  step = 1,
  onChange,
}: NumericComboboxProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [queryDraft, setQueryDraft] = useState<{
    forValue: number;
    text: string;
  } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const query =
    queryDraft?.forValue === value ? queryDraft.text : String(value);

  function setQuery(text: string) {
    setQueryDraft({ forValue: value, text });
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const options = useMemo(() => {
    const values: number[] = [];
    for (let next = min; next <= max; next += step) values.push(next);
    return values;
  }, [max, min, step]);

  function commit(nextQuery: string) {
    const nextValue = Number(nextQuery);
    if (!Number.isFinite(nextValue)) {
      setQuery(String(value));
      return;
    }

    const clamped = Math.min(max, Math.max(min, Math.round(nextValue)));
    onChange(clamped);
    setQuery(String(clamped));
  }

  return (
    <div className={styles.combo} ref={wrapperRef}>
      <input
        inputMode="numeric"
        value={query}
        onBlur={() => commit(query)}
        onChange={(event) => {
          const nextQuery = event.target.value.replace(/[^\d-]/g, "");
          setQuery(nextQuery);
          setIsOpen(true);
          if (nextQuery !== "" && nextQuery !== "-") {
            const nextValue = Number(nextQuery);
            if (Number.isFinite(nextValue)) onChange(nextValue);
          }
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setIsOpen(false);
          if (event.key === "Enter") {
            event.preventDefault();
            commit(query);
            setIsOpen(false);
          }
        }}
      />
      {isOpen ? (
        <div className={styles.comboMenu} role="listbox">
          {options.map((option) => (
            <button
              className={option === value ? styles.comboActive : undefined}
              key={option}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(option);
                setQuery(String(option));
                setIsOpen(false);
              }}
            >
              <span>{option}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
