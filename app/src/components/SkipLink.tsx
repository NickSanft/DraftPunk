interface Props {
  targetId: string;
}

export function SkipLink({ targetId }: Props) {
  return (
    <a href={`#${targetId}`} className="skip-link">
      Skip to canvas
    </a>
  );
}
