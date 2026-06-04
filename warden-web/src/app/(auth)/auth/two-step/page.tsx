"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Parity with the Angular app: OTP entry UI (verification endpoint not yet
// exposed by the API — the Angular page was a stub too).
export default function TwoStepPage() {
  const [values, setValues] = useState<string[]>(Array(6).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const onChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...values];
    next[index] = value;
    setValues(next);
    if (value && index < 5) refs.current[index + 1]?.focus();
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-2xl font-bold">Two-step verification</h1>
      <p className="text-muted-foreground">Enter the 6-digit code from your authenticator.</p>
      <div className="flex gap-2">
        {values.map((v, i) => (
          <Input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            maxLength={1}
            className="size-12 text-center text-lg"
            value={v}
            onChange={(e) => onChange(i, e.target.value)}
          />
        ))}
      </div>
      <Button className="w-full max-w-xs" disabled={values.some((v) => !v)}>
        Verify
      </Button>
      <Link href="/auth/login" className="text-sm text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
