/**
 * A value serialized for use inside an inline <script>: JSON, with every `<`
 * escaped so the text can never contain `</script>` and close the element early.
 * React has to be handed inline scripts as raw HTML (it would entity-encode the
 * quotes otherwise), so everything that goes into one goes through here.
 */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
