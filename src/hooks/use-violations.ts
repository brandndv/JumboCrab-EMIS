"use client"

import { useEffect, useState } from "react"

export type violationRow = {
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    avatarUrl?: string | null;
    violationType: string;
    violationDate: string;
    amount?: number;
    paidAmount: number;
    remainingAmount: number;
    installmentAmount?: number;
    status: string;
    remarks?: string;
    createdAt: string;
    updatedAt: string; //test
}

export function useViolationsState(){
    const [violations, setViolations] = useState<violationRow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    }