import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const ai = new GoogleGenAI();
const API_URL = "http://127.0.0.1:8080/api/sikayet";

async function prioritizeAndOptimizeComplaints() {
  try {
    const getRes = await fetch(API_URL);
    const complaints = await getRes.json();

    const prompt = `Here is a list of citizen complaints: ${JSON.stringify(complaints)}. Analyze these complaints, order them by civic importance and urgency, and return the updated list in the exact same JSON format.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const prioritizedComplaints = JSON.parse(response.text);

    const postRes = await fetch(`${API_URL}/update-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prioritizedComplaints),
    });

    console.log("Complaints successfully sorted and updated:", await postRes.json());
  } catch (error) {
    console.error("Error processing complaints with Gemini:", error);
  }
}

prioritizeAndOptimizeComplaints();

// we need to figure out when it is needed to call this function like for example is looking at the list enough to trigger it, what if it is already ordered then what?? etc etc

// Need to also add the respective departmants but we will not do it for now
