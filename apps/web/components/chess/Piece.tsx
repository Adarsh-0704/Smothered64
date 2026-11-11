import Image from "next/image";
import type { PieceLayoutCode } from "@smothered/chess_rule_engine";

interface PieceProps {
  readonly code: PieceLayoutCode;
  readonly name: string;
}

export default function Piece({ code, name }: PieceProps) {
  return (
    <Image
      src={`/chess/pieces/wood/${code.toLowerCase()}.png`}
      alt={name}
      fill
      sizes="12.5vw"
      draggable={false}
      priority
    />
  );
}
