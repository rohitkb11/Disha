import { CAREERS, COURSES, OPPORTUNITIES } from "@/lib/catalog";
export async function GET() {
  return Response.json(
    {
      version: "1.0",
      careers: CAREERS,
      courses: COURSES,
      opportunities: OPPORTUNITIES,
      notice:
        "Demonstration opportunities are explicitly labelled. Official program requirements must be verified with their provider.",
    },
    {
      headers: {
        "cache-control": "public, max-age=3600",
        "x-api-version": "1",
      },
    },
  );
}
