"use client";

import { Input } from "@/components/ui/input";
import { useEditorState } from "./editor-state";

/** Title input of the main form; edits show up in the preview right away. */
export function TitleField({ form }: { form: string }) {
  const { title, setTitle } = useEditorState();
  return (
    <Input
      name="title"
      form={form}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      required
    />
  );
}

/** Short info line shown under the title in the gallery. */
export function DescriptionField({
  form,
  label,
}: {
  form: string;
  label: string;
}) {
  const { description, setDescription } = useEditorState();
  return (
    <Input
      name="description"
      form={form}
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      maxLength={300}
      aria-label={label}
    />
  );
}
