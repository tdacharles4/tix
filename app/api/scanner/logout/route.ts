import { NextResponse } from "next/server";
import { clearScannerCookie } from "@/lib/scanner/cookies";

export async function POST() {
    clearScannerCookie();
    return NextResponse.json({ ok: true });
}