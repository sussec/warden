package com.techanv.warden.client;

import java.util.concurrent.TimeUnit;

/** Small environment + git helpers shared by the client and scanners. */
public final class Env {
    private Env() {}

    public static String get(String name, String def) {
        String v = System.getenv(name);
        return (v == null || v.isBlank()) ? def : v;
    }

    public static String require(String name) {
        String v = System.getenv(name);
        if (v == null || v.isBlank()) {
            System.err.println("[warden] missing required environment variable " + name);
            System.exit(2);
        }
        return v;
    }

    /** Run a git command in {@code cwd}, returning trimmed stdout or null. */
    public static String git(String cwd, String... args) {
        try {
            String[] cmd = new String[args.length + 1];
            cmd[0] = "git";
            System.arraycopy(args, 0, cmd, 1, args.length);
            Process p = new ProcessBuilder(cmd).directory(new java.io.File(cwd))
                    .redirectErrorStream(false).start();
            String out = new String(p.getInputStream().readAllBytes()).trim();
            p.waitFor(10, TimeUnit.SECONDS);
            return out.isBlank() ? null : out;
        } catch (Exception e) {
            return null;
        }
    }
}
