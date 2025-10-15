export async function GET(
  _request: Request,
  _props: { params: Promise<{ code: string }> },
) {
  // ShortUrls table was removed - this endpoint is deprecated
  // Return 404 for all short URL requests
  return new Response('Short URLs are no longer supported', { status: 404 });
}
