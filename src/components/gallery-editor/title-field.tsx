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
