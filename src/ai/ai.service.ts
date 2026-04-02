import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private groq: Groq;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (apiKey) {
      this.groq = new Groq({ apiKey });
    } else {
      this.logger.warn('GROQ_API_KEY not found in environment variables');
    }
  }

  async generateResponse(prompt: string, history: { role: string; content: string }[] = []) {
    if (!this.groq) {
      throw new Error('Groq AI not initialized. Please check your API key.');
    }

    try {
      this.logger.log(`Generating response via Groq...`);
      
      const messages: any[] = history.map(h => ({
        role: (h.role === 'bot' || h.role === 'model' ? 'assistant' : 'user') as "assistant" | "user",
        content: h.content,
      }));

      const systemPrompt = {
        role: 'system' as const,
        content: "Tu es un expert immobilier tunisien pour l'agence SmartProperty. Tu aides les clients à estimer leur budget d'achat ou de location de manière courtoise et professionnelle. Réponds de manière concise."
      };

      const completion = await this.groq.chat.completions.create({
        messages: [systemPrompt, ...messages, { role: 'user' as const, content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1024,
      });

      return completion.choices[0]?.message?.content || "Désolé, je ne peux pas répondre pour le moment.";
    } catch (error) {
      this.logger.error(`Error generating response from Groq: ${error.message}`);
      throw error;
    }
  }

  async estimateBudget(salary: number, goal: 'buy' | 'rent') {
    const prompt = `Mon salaire est de ${salary} DT et je souhaite ${goal === 'buy' ? 'acheter' : 'louer'}. Donne une estimation de ma capacité financière.`;
    return this.generateResponse(prompt);
  }

  /**
   * Interprets a voice command and returns a structured JSON action
   * for the frontend to execute (navigate, click, fill, or speak).
   */
  async interpretNavigationCommand(
    transcript: string,
    role: string,
    currentPath: string,
  ): Promise<{ action: string; target?: string; value?: string; message: string }> {
    if (!this.groq) {
      throw new Error('Groq AI not initialized. Please check your API key.');
    }

    const systemPrompt = `You are SmartProperty's voice navigation assistant. You help handicapped users navigate the platform using voice commands.
You MUST respond with ONLY valid JSON — no markdown, no explanation, no backticks. Just raw JSON.

The user's role is: "${role}"
The user is currently on: "${currentPath}"

AVAILABLE ROUTES BY ROLE:

For "client" role:
- /client-space → Dashboard (home page for client)
- /client-space/profile → My Profile
- /client-space/profile/edit → Edit Profile
- /client-space/profile/security → Security Settings / Change Password
- /client-space/profile/saved → Saved Properties (in profile)
- /client-space/saved-properties → Saved Properties page
- /client-space/complaints → My Complaints list
- /client-space/complaints/new → Create New Complaint / File a complaint
- /front-office → Browse Properties / Home page
- /front-office/search → Search Results (all properties)
- /front-office/search?type=rent → Properties For Rent / Rental properties
- /front-office/search?type=sale → Properties For Sale / Buy properties
- /front-office/branches → View Branches / Branch locations
- /front-office/property-detail/{id} → View a specific property detail (replace {id} with actual property ID)
- /front-office/visit-request/{propertyId} → Schedule a visit for a property (replace {propertyId} with actual ID)

IMPORTANT NAVIGATION RULES FOR CLIENT:
- When user says "for rent", "show rentals", "rental properties", "properties to rent" → navigate to /front-office/search?type=rent
- When user says "for sale", "buy", "properties to buy", "purchase" → navigate to /front-office/search?type=sale
- When user says "show properties", "browse properties", "all properties" → navigate to /front-office/search
- When user says "schedule a visit", "book a visit" → click the "Schedule a Visit" or "Book Visit" or "Request Visit" button
- When user says "apply", "apply for this", "submit application" → click the "Apply" or "Apply Now" or "Submit Application" button
- When user says "save this property", "bookmark", "add to saved" → click the "Save" or bookmark/heart button
- When user says "go back", "back" → use action "go_back"

For "super_admin" role:
- /admin-space/dashboard → Admin Dashboard
- /admin-space/branch-management → Branch Management
- /admin-space/user-management → User Management
- /admin-space/complaints → Client Complaints
- /admin-space/profile → My Account

For "branch_manager" role:
- /branch-manager-space → Dashboard
- /branch-manager-space/users → User Management / Agents
- /branch-manager-space/property → Properties
- /branch-manager-space/complaints → Complaints
- /branch-manager-space/profile → Profile

For "real_estate_agent" role:
- /real-estate-agent-space → Dashboard
- /real-estate-agent-space/properties → Properties List
- /real-estate-agent-space/properties/add → Add New Property
- /real-estate-agent-space/visits → Visits
- /real-estate-agent-space/profile → Profile

For "accountant" role:
- /accountant-space/dashboard → Financial Overview
- /accountant-space/invoices → Invoices
- /accountant-space/profile → Profile

CLICKABLE BUTTONS ON PAGES:
- On property listings (search page): each property card can be clicked to view details. The user can say "open the first property" or "click on [property name]".
- On property detail page: "Schedule a Visit", "Book Visit", "Request Visit", "Apply", "Apply Now", "Save", heart/bookmark icon, "Contact Agent", "Back"
- On complaints page: "New Complaint", "File Complaint", "Submit"
- On profile page: "Edit Profile", "Change Password", "Save Changes", "Upload Photo"
- On any page: "Back" or "Go Back" to navigate to the previous page

ACTIONS you can return:
1. "navigate" — go to a page. Set "target" to the route path (include query params like ?type=rent if needed).
2. "click" — click a button/link. Set "target" to the button text content (what the button says).
3. "fill" — fill an input field. Set "target" to the input placeholder or label text, and "value" to what to fill in.
4. "scroll" — scroll the page. Set "target" to "up" or "down".
5. "go_back" — go to the previous page (browser back). No target needed.
6. "speak" — just respond verbally (for greetings, help, unclear commands).

RESPONSE FORMAT (JSON only, no markdown):
{"action": "navigate", "target": "/path", "message": "Taking you to ..."}
{"action": "navigate", "target": "/front-office/search?type=rent", "message": "Showing properties for rent..."}
{"action": "click", "target": "button text", "message": "Clicking on ..."}
{"action": "fill", "target": "placeholder or label", "value": "text to fill", "message": "Filling ... with ..."}
{"action": "scroll", "target": "down", "message": "Scrolling down"}
{"action": "go_back", "message": "Going back to the previous page"}
{"action": "speak", "message": "your helpful response"}

RULES:
- Always be helpful, friendly, and concise in the "message" field.
- If the user asks "where can I go" or "what can I do", list the available pages for their role.
- If the user's command is unclear, ask for clarification with action "speak".
- Match commands flexibly: "go to complaints", "show my complaints", "take me to complaints", "open complaints" should all navigate to complaints.
- The "message" field is spoken aloud to the user, keep it short and natural.
- NEVER include markdown formatting, code blocks, or backticks in your response. ONLY raw JSON.`;

    try {
      this.logger.log(`Interpreting navigation command: "${transcript}" for role: ${role}`);

      const completion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: transcript },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 256,
      });

      const raw = completion.choices[0]?.message?.content || '';
      this.logger.log(`Raw Groq response: ${raw}`);

      // Parse JSON from response — handle potential markdown wrapping
      let cleaned = raw.trim();
      // Remove markdown code fences if present
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
      }

      try {
        const parsed = JSON.parse(cleaned);
        return {
          action: parsed.action || 'speak',
          target: parsed.target || undefined,
          value: parsed.value || undefined,
          message: parsed.message || 'I understood your command.',
        };
      } catch (parseError) {
        this.logger.warn(`Could not parse Groq response as JSON: ${cleaned}`);
        return {
          action: 'speak',
          message: "I'm sorry, I couldn't understand that. Could you please repeat your command?",
        };
      }
    } catch (error) {
      this.logger.error(`Error interpreting navigation command: ${error.message}`);
      throw error;
    }
  }
}
