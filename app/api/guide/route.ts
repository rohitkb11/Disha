import { z } from "zod";
import {
  getContext,
  ownedStudent,
  readJson,
  aiConfig,
  errorResponse,
  apiError,
  rateLimit,
} from "@/lib/server";
import { retrieve, matchCareers } from "@/lib/domain";
import { generateGuidance } from "@/lib/ai";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const input = await readJson(request);
    const context = await getContext(request);
    const parsed = z
      .object({
        studentId: z.string().max(120),
        message: z.string().trim().min(1).max(2000),
        language: z.enum(["en", "hi", "mr"]),
      })
      .safeParse(input);
    if (!parsed.success) throw apiError(400, "Please send a shorter question.");
    const student = await ownedStudent(context, parsed.data.studentId);
    if (!student) throw apiError(404, "Sync your learner profile first.");
    await rateLimit(context, "guide", 12);
    const sources = retrieve(parsed.data.message, student.profile);
    const generated = await generateGuidance(
      aiConfig(),
      parsed.data.message,
      parsed.data.language,
      student.profile,
      sources,
    );
    const top = matchCareers(student.profile)[0].career;
    const fallback =
      parsed.data.language === "hi"
        ? `आप ${top.hi} का रास्ता खोज सकते हैं। ${sources[0].title} से शुरुआत करें। आधिकारिक स्रोत पर वर्तमान नियम जाँचें और अपने शिक्षक से अगला कदम तय करें। यह उत्तर ज्ञान-संग्रह से है; भाषा मॉडल अभी उपलब्ध नहीं है।`
        : parsed.data.language === "mr"
          ? `तुम्ही ${top.mr} या पर्यायाचा शोध घेऊ शकता. ${sources[0].title} पासून सुरुवात करा. अधिकृत स्रोतावरील सध्याचे नियम तपासा आणि शिक्षकांसोबत पुढचे पाऊल ठरवा. हे उत्तर माहिती-संग्रहावर आधारित आहे; भाषा मॉडेल सध्या उपलब्ध नाही.`
          : `A starting point from the catalogue:\n\n${sources[0].title}: ${sources[0].text.slice(0, 600)}\n\nNext step: compare this with ${top.title}, try one introductory lesson and discuss it with your facilitator. Confirm current requirements with the provider. This answer uses catalogue retrieval; a language model is unavailable or its answer could not be validated.`;
    return Response.json(
      {
        answer: generated?.answer || fallback,
        mode: generated?.mode || "knowledge-base",
        sources: sources
          .filter((_, i) => !generated || generated.sourceIds.includes(i + 1))
          .map(({ title, url }) => ({ title, url })),
        limitations:
          "Career exploration guidance. Confirm admissions, employment and scheme rules with the provider.",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
