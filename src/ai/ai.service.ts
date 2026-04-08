import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { PropertyService } from '../property/property.service';
import { BranchService } from '../branch/branch.service';

// Import Fuse - use require to handle both CommonJS and ESM
const Fuse = require('fuse.js');

export type VoiceNavigationResult = {
  action: string;
  target?: string;
  value?: string;
  message: string;
  voiceHook?: string;
  nextPrompt?: string;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private groq!: Groq;

  constructor(
    private configService: ConfigService,
    private propertyService: PropertyService,
    private branchService: BranchService,
  ) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (apiKey) {
      this.groq = new Groq({ apiKey });
    } else {
      this.logger.warn('GROQ_API_KEY not found in environment variables');
    }
  }

  async generateResponse(
    prompt: string,
    history: { role: string; content: string }[] = [],
  ) {
    if (!this.groq) {
      throw new Error('Groq AI not initialized. Please check your API key.');
    }

    try {
      this.logger.log(`Generating response via Groq...`);

      const messages: any[] = history.map((h) => ({
        role: h.role === 'bot' || h.role === 'model' ? 'assistant' : 'user',
        content: h.content,
      }));

      const systemPrompt = {
        role: 'system' as const,
        content:
          "Tu es un expert immobilier tunisien pour l'agence SmartProperty. Tu aides les clients à estimer leur budget d'achat ou de location de manière courtoise et professionnelle. Réponds de manière concise.",
      };

      const completion = await this.groq.chat.completions.create({
        messages: [
          systemPrompt,
          ...messages,
          { role: 'user' as const, content: prompt },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1024,
      });

      return (
        completion.choices[0]?.message?.content ||
        'Désolé, je ne peux pas répondre pour le moment.'
      );
    } catch (error: any) {
      this.logger.error(
        `Error generating response from Groq: ${error?.message || error}`,
      );
      throw error;
    }
  }

  async estimateBudget(salary: number, goal: 'buy' | 'rent') {
    const prompt = `Mon salaire est de ${salary} DT et je souhaite ${goal === 'buy' ? 'acheter' : 'louer'}. Donne une estimation de ma capacité financière.`;
    return this.generateResponse(prompt);
  }

  private foldAscii(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /** Speech engines often append periods; breaks $-anchored keyword routes. */
  private normalizeVoiceTranscript(transcript: string): string {
    return transcript
      .trim()
      .replace(/[.!?…]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Strip "open … property details" so Fuse sees "borj cedria". */
  private extractPlaceQuery(transcript: string): string {
    let s = transcript.trim();
    for (let i = 0; i < 5; i++) {
      const before = s;
      s = s
        .replace(
          /^(please|okay|ok|hey|can you|could you|would you|i want to|i need to|i'd like to|i would like to|show me|let me see|take me to|navigate to|bring me to|go to|head to|open( up)?|view|see|display|find)\s+/gi,
          '',
        )
        .trim();
      s = s.replace(/\s+(please|thanks|thank you|now)\s*$/gi, '').trim();
      if (s === before) break;
    }
    for (let i = 0; i < 4; i++) {
      const before = s;
      s = s
        .replace(
          /\s+(property|properties|listing|listings|detail|details|detail page|the page|thing)\s*$/gi,
          '',
        )
        .trim();
      s = s
        .replace(/\s+(branch|office)(\s+detail|\s+details|\s+page)?\s*$/gi, '')
        .trim();
      if (s === before) break;
    }
    s = s.replace(/^(the|a|an|this|that)\s+/gi, '').trim();
    return s.replace(/[.!?…]+$/g, '').trim();
  }

  /** "property named Villa Rose" / "branch called Tunis Centre" / "open property salim" */
  private extractExplicitPlaceName(transcript: string): string | null {
    const t = transcript.trim();

    // Match "open property <name>" pattern
    let m = t.match(
      /\b(?:open|show|view)\s+(?:property|properties|listing)\s+(.+)/i,
    );
    if (m) {
      let rest = m[1].trim();
      rest = rest
        .replace(/\s+(property|properties|details?|page)\s*$/i, '')
        .trim();
      if (rest.length >= 2) return rest;
    }

    // Match "property named Villa Rose" pattern
    m = t.match(
      /\b(?:property|properties|listing|place|apartment|villa|studio|flat|house|home)\s+(?:named|called)\s+(.+)/i,
    );
    if (m) {
      let rest = m[1].trim();
      rest = rest
        .replace(/\s+(property|properties|details?|page)\s*$/i, '')
        .trim();
      return rest.length >= 2 ? rest : null;
    }

    // Match "branch called/named" pattern
    m = t.match(/\bbranch(?:es)?\s+(?:named|called)\s+(.+)/i);
    if (m) {
      let rest = m[1].trim();
      rest = rest.replace(/\s+(branch|office|details?|page)\s*$/i, '').trim();
      return rest.length >= 2 ? rest : null;
    }
    return null;
  }

  /** Last 2–4 words help match "… in Borj Cedria" against branch/property labels */
  private tailWordQueries(placeQ: string): string[] {
    const words = placeQ
      .split(/\s+/)
      .filter((w) => w.replace(/[^a-z0-9]/gi, '').length > 1);
    const out: string[] = [];
    if (words.length >= 2) out.push(words.slice(-2).join(' '));
    if (words.length >= 3) out.push(words.slice(-3).join(' '));
    if (words.length >= 4) out.push(words.slice(-4).join(' '));
    return [...new Set(out)];
  }

  private readonly vaguePlaceSingleWords = new Set([
    'apartment',
    'apartments',
    'house',
    'home',
    'villa',
    'studio',
    'flat',
    'duplex',
    'property',
    'properties',
    'listing',
    'listings',
    'branch',
    'branches',
    'office',
    'rent',
    'sale',
  ]);

  private isTooVaguePlaceQuery(q: string): boolean {
    const words = q
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.replace(/[^a-z0-9]/gi, '').length > 0);
    if (words.length === 0) return true;
    if (
      words.length === 1 &&
      this.vaguePlaceSingleWords.has(words[0].replace(/[^a-z0-9]/gi, ''))
    ) {
      return true;
    }
    return false;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const v0 = new Array<number>(n + 1);
    const v1 = new Array<number>(n + 1);
    for (let j = 0; j <= n; j++) v0[j] = j;
    for (let i = 0; i < m; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < n; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let j = 0; j <= n; j++) v0[j] = v1[j];
    }
    return v0[n];
  }

  /** 1 = identical, 0 = very different */
  private normalizedLevenshtein(a: string, b: string): number {
    if (!a.length && !b.length) return 1;
    if (!a.length || !b.length) return 0;
    const d = this.levenshtein(a, b);
    return 1 - d / Math.max(a.length, b.length);
  }

  /** Sørensen–Dice on character bigrams (good for STT garbling) */
  private diceBigrams(a: string, b: string): number {
    const ca = this.foldAscii(a).replace(/\s+/g, '');
    const cb = this.foldAscii(b).replace(/\s+/g, '');
    if (ca.length < 2 || cb.length < 2) return 0;
    const bigrams = (s: string) => {
      const m = new Map<string, number>();
      for (let i = 0; i < s.length - 1; i++) {
        const g = s.slice(i, i + 2);
        m.set(g, (m.get(g) || 0) + 1);
      }
      return m;
    };
    const A = bigrams(ca);
    const B = bigrams(cb);
    let inter = 0;
    for (const [g, c] of A) {
      inter += Math.min(c, B.get(g) || 0);
    }
    return (2 * inter) / Math.max(1, ca.length - 1 + (cb.length - 1));
  }

  /**
   * STT-tolerant score: "borstadrea" / "ariana brands" vs title + address + description chunk.
   */
  private scoreNameAgainstLabel(query: string, label: string): number {
    const qSp = this.foldAscii(query).trim().replace(/\s+/g, ' ');
    const labSp = this.foldAscii(label)
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 240);
    if (!qSp.length || !labSp.length) return 0;

    const cq = qSp.replace(/\s/g, '');
    const cl = labSp.replace(/\s/g, '');
    let best = 0;

    if (cq.length >= 3 && cl.includes(cq)) best = Math.max(best, 0.93);
    if (cl.length >= 4 && cq.includes(cl)) best = Math.max(best, 0.88);

    best = Math.max(best, this.normalizedLevenshtein(cq, cl));
    best = Math.max(best, this.diceBigrams(cq, cl));

    const qt = qSp.split(/\s+/).filter((w) => w.length > 1);
    const lt = labSp.split(/\s+/).filter((w) => w.length > 1);
    if (qt.length && lt.length) {
      let sum = 0;
      let counted = 0;
      for (const w of qt) {
        if (this.vaguePlaceSingleWords.has(w)) continue;
        counted++;
        let mx = 0;
        if (w.length >= 3 && labSp.includes(w)) mx = Math.max(mx, 0.9);
        for (const v of lt) {
          if (w.length >= 3 && (v.includes(w) || w.includes(v)))
            mx = Math.max(mx, 0.88);
          mx = Math.max(mx, this.normalizedLevenshtein(w, v));
          mx = Math.max(mx, this.diceBigrams(w, v));
        }
        sum += mx;
      }
      if (counted > 0) best = Math.max(best, sum / counted);
    }

    if (best < 0.45 && cq.length >= 4 && cl.length >= 4) {
      const qLen = cq.length;
      const lo = Math.max(4, qLen - 6);
      const hi = Math.min(cl.length, qLen + 10);
      let evals = 0;
      for (let len = lo; len <= hi && evals < 28; len++) {
        const step = Math.max(1, Math.ceil(len / 4));
        for (let i = 0; i + len <= cl.length && evals < 28; i += step) {
          evals++;
          const sub = cl.slice(i, i + len);
          best = Math.max(best, this.normalizedLevenshtein(cq, sub) * 0.97);
          best = Math.max(best, this.diceBigrams(cq, sub) * 0.97);
        }
      }
    }

    return Math.min(1, best);
  }

  private mergeHybridWithFuse<
    T extends { id: string; label: string; ascii: string },
  >(
    items: T[],
    queries: string[],
    fuseBest: { item: T; score: number } | null,
    runFullScan: boolean,
  ): { item: T; score: number } | null {
    const byId = new Map<string, { item: T; score: number }>();

    const bump = (it: T, s: number) => {
      const cur = byId.get(it.id);
      if (!cur || s > cur.score) byId.set(it.id, { item: it, score: s });
    };

    if (fuseBest && fuseBest.score < 0.92) {
      const fuseGood = 1 - Math.min(fuseBest.score, 0.99);
      bump(fuseBest.item, fuseGood * 0.82);
    }

    const qList = queries.filter(
      (q) => q.length >= 2 && !this.isTooVaguePlaceQuery(q),
    );
    const scanItems = (list: T[]) => {
      for (const it of list) {
        let mx = 0;
        for (const q of qList) {
          mx = Math.max(mx, this.scoreNameAgainstLabel(q, it.label));
        }
        if (mx > 0.01) bump(it, mx);
      }
    };

    if (runFullScan) {
      scanItems(items);
    } else {
      const idSet = new Set<string>();
      if (fuseBest) idSet.add(fuseBest.item.id);
      for (const q of qList.slice(0, 4)) {
        try {
          const fuse = new Fuse(items, {
            keys: ['label', 'ascii'] as string[],
            includeScore: true,
            threshold: 0.72,
            ignoreLocation: true,
            minMatchCharLength: 2,
          });
          for (const r of fuse.search(q).slice(0, 18)) {
            idSet.add((r.item as T).id);
          }
        } catch (err) {
          // Fallback: add items that contain the query string
          for (const item of items) {
            if (
              item.label.toLowerCase().includes(q.toLowerCase()) ||
              item.ascii.includes(q.toLowerCase())
            ) {
              idSet.add(item.id);
            }
          }
        }
      }
      const subset = items.filter((it) => idSet.has(it.id));
      scanItems(subset.length > 0 ? subset : items.slice(0, 80));
    }

    let best: { item: T; score: number } | null = null;
    for (const v of byId.values()) {
      if (!best || v.score > best.score) best = v;
    }
    return best;
  }

  /**
   * Deterministic routes so phrases like "go to for rent" always work (no LLM).
   */
  private tryKeywordNavigation(
    transcript: string,
    role: string,
    currentPath: string = '',
  ): VoiceNavigationResult | null {
    const raw = this.normalizeVoiceTranscript(transcript);
    const t = raw.toLowerCase().replace(/\s+/g, ' ');
    if (!t) return null;

    if (/^(go back|go backward|back|previous page|last page)$/i.test(t)) {
      return { action: 'go_back', message: 'Going back.' };
    }

    const wantsRent =
      /\b(for rent|properties for rent|property for rent|rentals?|rent only|to rent|show rent|rent search|looking to rent)\b/.test(
        t,
      ) ||
      /^(go to|take me to|open|navigate to|show|bring me to)\s+(the\s+)?for rent$/i.test(
        raw,
      );

    const wantsSale =
      /\b(for sale|properties for sale|property for sale|to buy|buy properties|buy a (home|house|property)|purchase|on sale)\b/.test(
        t,
      ) ||
      /^(go to|take me to|open|navigate to|show)\s+(the\s+)?for sale$/i.test(
        raw,
      );

    if (wantsRent && !wantsSale) {
      return {
        action: 'navigate',
        target: '/front-office/search?type=rent',
        message: 'Showing properties for rent.',
      };
    }
    if (wantsSale && !wantsRent) {
      return {
        action: 'navigate',
        target: '/front-office/search?type=sale',
        message: 'Showing properties for sale.',
      };
    }

    const wantsAllSearch =
      /\b(all properties|property search|browse (all\s+)?properties|listings|search (all\s+)?properties?)\b/.test(
        t,
      ) || /^(go to|open|take me to)\s+(the\s+)?search$/i.test(raw);

    if (wantsAllSearch) {
      return {
        action: 'navigate',
        target: '/front-office/search',
        message: 'Opening property search.',
      };
    }

    const wantsHome =
      /^home$/i.test(raw) ||
      /^main$/i.test(raw) ||
      /\b(home page|main page|front office|landing|property home|browse home)\b/.test(
        t,
      ) ||
      /\bgo\s+home\b/.test(t) ||
      /^(go to|take me to|open|head to|navigate to)(\s+me)?(\s+to)?\s+(the\s+)?(main|home)(\s+page)?$/i.test(
        raw,
      );

    if (wantsHome) {
      return {
        action: 'navigate',
        target: '/front-office',
        message: 'Going to the home page.',
      };
    }

    const wantsBranchList =
      /^branches?$/i.test(raw) ||
      /^(go to|take me to|open|head to|show|view|navigate to)(\s+me)?(\s+to)?\s+(the\s+)?(all\s+)?branches?$/i.test(
        raw,
      ) ||
      /\b(branch list|all branches|our branches|office locations?|agency locations?|list of branches)\b/.test(
        t,
      ) ||
      /\b(show|open|view)\s+(me\s+)?(the\s+)?(all\s+)?branches?\b/.test(t) ||
      /\b(go to|take me to|navigate to)\s+(the\s+)?branches?\b/.test(t);

    if (wantsBranchList) {
      return {
        action: 'navigate',
        target: '/front-office/branches',
        message: 'Opening the branches list.',
      };
    }

    const wantsProfile =
      /\b(my\s+)?profile\b/.test(t) ||
      /\baccount\s+(page|settings)\b/.test(t) ||
      /^(go to|open|take me to)\s+profile$/i.test(raw);

    if (wantsProfile) {
      const target =
        role === 'guest' ? '/front-office/profile' : '/client-space/profile';
      return { action: 'navigate', target, message: 'Opening your profile.' };
    }

    const wantsContact =
      /\b(contact|contact\s+us|contact\s+page)\b/.test(t) ||
      /^(go to|take me to|open|navigate to)\s+contact$/i.test(raw);

    if (wantsContact) {
      return {
        action: 'navigate',
        target: '/front-office/contact',
        message: 'Opening the contact page.',
      };
    }

    if (role === 'client') {
      if (
        /\b(dashboard|my dashboard|client (home|dashboard))\b/.test(t) ||
        /^dashboard$/i.test(raw)
      ) {
        return {
          action: 'navigate',
          target: '/client-space',
          message: 'Opening your dashboard.',
        };
      }
      if (/\bsaved(\s+properties)?\b/.test(t) || /\bbookmarks?\b/.test(t)) {
        return {
          action: 'navigate',
          target: '/client-space/saved-properties',
          message: 'Opening saved properties.',
        };
      }
      if (/\b(my\s+)?applications?\b/.test(t)) {
        return {
          action: 'navigate',
          target: '/client-space/my-applications',
          message: 'Opening your applications.',
        };
      }
      if (
        /\b(file|create)\s+(a\s+)?(new\s+)?complaint\b/.test(t) ||
        /\bnew\s+complaint\b/.test(t)
      ) {
        return {
          action: 'navigate',
          target: '/client-space/complaints/new',
          message: 'Opening the complaint form.',
        };
      }
      if (/\bcomplaints?\b/.test(t)) {
        return {
          action: 'navigate',
          target: '/client-space/complaints',
          message: 'Opening complaints.',
        };
      }
      if (/\b(add\s+property|add\s+new\s+property|create\s+property|new\s+property|post\s+property|list\s+property)\b/.test(t)) {
        return {
          action: 'navigate',
          target: '/client-space/properties/add',
          message: 'Opening property creation form.',
        };
      }
    }

    // Branch detail page commands
    if (currentPath.includes('/front-office/branches/')) {
      // Call branch
      if (/\b(call|phone|call\s+the\s+branch|call\s+branch|dial)\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'branch-call',
          message: 'Calling the branch.',
        };
      }

      // Send email
      if (/\b(email|send\s+e-mail|send\s+an\s+e-mail|message|contact\s+by\s+e-mail)\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'branch-email',
          message: 'Opening email.',
        };
      }

      // Get directions
      if (/\b(directions|map|navigate|show\s+map|get\s+directions|navigate\s+to|how\s+to\s+get|where\s+is)\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'branch-directions',
          message: 'Opening directions.',
        };
      }

      // View properties
      if (/\b(properties|browse\s+properties|see\s+properties|view\s+properties|show\s+properties|listings)\b/.test(t) && !/\bback\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'branch-view-properties',
          message: 'Showing properties for this branch.',
        };
      }

      // Back to branches
      if (/\b(back|go\s+back|back\s+to\s+branches|previous|branches\s+list)\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'branch-back',
          message: 'Going back to branches.',
        };
      }
    }

    // Property detail page commands
    if (currentPath.includes('/front-office/property-detail/')) {
      // Like property
      if (/\b(like|like\s+this|like\s+this\s+property)\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'property-like',
          message: 'Liked the property.',
        };
      }

      // Dislike property
      if (/\b(dislike|unlike|don't\s+like|not\s+interested)\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'property-like',
          message: 'Removed from favorites.',
        };
      }

      // Copy link
      if (/\b(copy\s+link|copy\s+the\s+link|copy\s+url)\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'property-copy-link',
          message: 'Link copied to clipboard.',
        };
      }

      // Share via WhatsApp
      if (/\b(share\s+via\s+whatsapp|whatsapp|send\s+via\s+whatsapp|share\s+whatsapp)\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'property-share-whatsapp',
          message: 'Opening WhatsApp to share.',
        };
      }

      // Schedule visit
      if (/\b(schedule\s+visit|book\s+visit|visit|schedule|make\s+appointment)\b/.test(t) && !/cancel/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'open-schedule-visit',
          message: 'Opening visit scheduling.',
        };
      }

      // Apply
      if (/\b(apply|apply\s+now|submit\s+application)\b/.test(t) && !/cancel/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'open-apply-modal',
          message: 'Opening application form.',
        };
      }

      // Call real estate agent
      if (/\b(call|phone|call\s+agent|call\s+real\s+estate\s+agent)\b/.test(t) && !/whatsapp/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'property-call-agent',
          message: 'Calling the real estate agent.',
        };
      }

      // WhatsApp real estate agent
      if (/\b(whatsapp|contact\s+via\s+whatsapp|message\s+agent|whatsapp\s+agent)\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'property-whatsapp-agent',
          message: 'Opening WhatsApp to contact agent.',
        };
      }

      // More about property (contact form)
      if (/\b(more|more\s+about|more\s+info|information|details|contact)\b/.test(t) && !/\bback\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'property-contact-form',
          message: 'Opening contact form for more information.',
        };
      }

      // Send message (in contact form)
      if (/\b(send|send\s+message|submit)\b/.test(t) && !/cancel/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'property-send-message',
          message: 'Sending message.',
        };
      }

      // Cancel
      if (/\bcancel\b/.test(t)) {
        return {
          action: 'click',
          voiceHook: 'property-cancel',
          message: 'Canceling.',
        };
      }
    }

    return null;
  }

  /**
   * Fuzzy match place names: Fuse + STT-tolerant hybrid (Levenshtein, Dice bigrams, token overlap).
   */
  private tryFuzzyEntityNavigation(
    transcript: string,
    properties: { id: string; label: string; ascii: string }[],
    branches: { id: string; label: string; ascii: string }[],
  ): VoiceNavigationResult | null {
    const t = this.normalizeVoiceTranscript(transcript);
    if (t.length < 3) return null;

    const tl = t.toLowerCase();

    if (
      /^branches?$/i.test(t) ||
      /^(go to|take me to|open|head to|show|view|navigate to)(\s+me)?(\s+to)?\s+(the\s+)?(all\s+)?branches?$/i.test(
        t,
      ) ||
      /^(go to|take me to|open|head to|navigate to)(\s+me)?(\s+to)?\s+(the\s+)?(main|home)(\s+page)?$/i.test(
        t,
      ) ||
      /^home$/i.test(t) ||
      /^main$/i.test(t)
    ) {
      return null;
    }

    if (/^(schedule|book)(\s+a)?\s+visit\b/i.test(t)) return null;
    if (/^apply(\s+now)?\b/i.test(t)) return null;

    const genericPropertyBrowse =
      /^(show|open|view|browse)\s+(me\s+)?(all\s+)?(properties|listings|homes?)$/i.test(
        tl,
      ) || /^(properties|listings)\s+(for\s+)?(rent|sale)$/i.test(tl);
    if (genericPropertyBrowse) return null;

    const explicit = this.extractExplicitPlaceName(t);
    const placeQ = this.extractPlaceQuery(t);
    const tailQs = this.tailWordQueries(placeQ);

    const queries = [
      ...(explicit ? [explicit, this.foldAscii(explicit)] : []),
      placeQ,
      this.foldAscii(placeQ),
      ...tailQs,
      ...tailQs.map((q) => this.foldAscii(q)),
      t,
      this.foldAscii(t),
    ].filter((q, i, arr) => q.length >= 2 && arr.indexOf(q) === i);

    this.logger.debug(
      `🔍 Fuzzy search queries: [${queries.map((q) => `"${q}"`).join(', ')}]`,
    );
    this.logger.debug(`📍 Explicit match attempt: "${explicit}"`);
    this.logger.debug(`📝 Place query: "${placeQ}"`);

    try {
      const fuseOpts = {
        keys: ['label', 'ascii'] as string[],
        includeScore: true,
        threshold: 0.72,
        ignoreLocation: true,
        minMatchCharLength: 2,
      };

      this.logger.debug(
        `Searching in ${properties.length} properties and ${branches.length} branches`,
      );
      if (properties.length > 0) {
        this.logger.debug(
          `Sample properties: ${properties
            .slice(0, 3)
            .map((p) => `"${p.label}"`)
            .join(', ')}`,
        );
      }

      let fuseP: any = null;
      let fuseB: any = null;

      try {
        fuseP = new Fuse(properties, fuseOpts);
        fuseB = new Fuse(branches, fuseOpts);
        this.logger.debug(`✅ Fuse initialized successfully`);
      } catch (fuseErr: any) {
        this.logger.warn(`⚠️ Fuse initialization failed: ${fuseErr?.message}`);
      }

      let pScore = 1;
      let pItem: (typeof properties)[0] | null = null;
      let bScore = 1;
      let bItem: (typeof branches)[0] | null = null;

      for (const q of queries) {
        if (!fuseP) {
          for (const prop of properties) {
            const labelScore =
              q.toLowerCase() === prop.label.toLowerCase()
                ? 0
                : prop.label.toLowerCase().includes(q.toLowerCase())
                  ? 0.3
                  : prop.ascii.includes(q)
                    ? 0.5
                    : 1;
            if (labelScore < pScore && labelScore < 0.8) {
              pScore = labelScore;
              pItem = prop;
            }
          }
        } else {
          const pr = fuseP.search(q)[0];
          const ps = pr?.score ?? 1;
          if (pr && ps < pScore) {
            pScore = ps;
            pItem = pr.item as (typeof properties)[0];
          }
        }

        if (!fuseB) {
          for (const branch of branches) {
            const labelScore =
              q.toLowerCase() === branch.label.toLowerCase()
                ? 0
                : branch.label.toLowerCase().includes(q.toLowerCase())
                  ? 0.3
                  : branch.ascii.includes(q)
                    ? 0.5
                    : 1;
            if (labelScore < bScore && labelScore < 0.8) {
              bScore = labelScore;
              bItem = branch;
            }
          }
        } else {
          const br = fuseB.search(q)[0];
          const bs = br?.score ?? 1;
          if (br && bs < bScore) {
            bScore = bs;
            bItem = br.item as (typeof branches)[0];
          }
        }
      }

      const runFullScan =
        Boolean(explicit) ||
        pScore > 0.46 ||
        bScore > 0.46 ||
        placeQ
          .split(/\s+/)
          .filter((w) => w.replace(/[^a-z0-9]/gi, '').length > 1).length >= 2;

      const mergedP = this.mergeHybridWithFuse(
        properties,
        queries,
        pItem ? { item: pItem, score: pScore } : null,
        runFullScan,
      );
      const mergedB = this.mergeHybridWithFuse(
        branches,
        queries,
        bItem ? { item: bItem, score: bScore } : null,
        runFullScan,
      );

      const gP = mergedP?.score ?? 0;
      const gB = mergedB?.score ?? 0;

      // STRICT MATCHING: Only match if explicitly commanded with "open property" or "open branch"
      const saidOpenProperty =
        /\b(?:open|show|view)\s+(?:property|properties|listing)\b/i.test(t);
      const saidOpenBranch =
        /\b(?:open|show|view)\s+(?:branch|branches|office)\b/i.test(t);

      this.logger.debug(`🎤 Explicit match: "${explicit}"`);
      this.logger.debug(`📖 Said "open property": ${saidOpenProperty}`);
      this.logger.debug(`📖 Said "open branch": ${saidOpenBranch}`);
      this.logger.debug(
        `📊 Scores - Property: ${gP.toFixed(3)}, Branch: ${gB.toFixed(3)}`,
      );

      // Only allow matching if user explicitly said "open property" or "open branch"
      if (!explicit && !saidOpenProperty && !saidOpenBranch) {
        this.logger.debug(`❌ No explicit command - rejecting match`);
        return null;
      }

      // MINIMUM THRESHOLD (any valid match > 0)
      const MIN_MATCH_SCORE = 0.01;

      if (saidOpenProperty && mergedP && gP > MIN_MATCH_SCORE) {
        this.logger.debug(
          `✅ Opening property: "${mergedP.item.label}" (score: ${gP.toFixed(3)})`,
        );
        return {
          action: 'navigate',
          target: `/front-office/property-detail/${mergedP.item.id}`,
          message: `Opening ${mergedP.item.label.split(/\s+/).slice(0, 5).join(' ')}.`,
        };
      }

      if (saidOpenBranch && mergedB && gB > MIN_MATCH_SCORE) {
        this.logger.debug(
          `✅ Opening branch: "${mergedB.item.label}" (score: ${gB.toFixed(3)})`,
        );
        return {
          action: 'navigate',
          target: `/front-office/branches/${mergedB.item.id}`,
          message: `Opening ${mergedB.item.label.split(/\s+/).slice(0, 5).join(' ')}.`,
        };
      }

      return null;
    } catch (err: any) {
      this.logger.error(`❌ Fuzzy matching error: ${err?.message}`);
      return null;
    }
  }

  /**
   * Voice navigation for clients only. Returns JSON actions for the frontend.
   */
  async interpretNavigationCommand(
    transcript: string,
    role: string,
    currentPath: string,
  ): Promise<VoiceNavigationResult> {
    const normalizedRole = (role || 'guest').toLowerCase();
    if (!['client', 'guest'].includes(normalizedRole)) {
      return {
        action: 'speak',
        message:
          'The voice assistant is only available for clients and guests browsing the site.',
      };
    }

    const tClean = this.normalizeVoiceTranscript(transcript);
    if (!tClean) {
      return {
        action: 'speak',
        message: 'I did not catch that. Please try again.',
      };
    }

    const keywordHit = this.tryKeywordNavigation(tClean, normalizedRole, currentPath);
    if (keywordHit) {
      this.logger.log(
        `Keyword navigation: ${keywordHit.target || keywordHit.action}`,
      );
      return keywordHit;
    }

    try {
      const [propCatalog, branchList] = await Promise.all([
        this.propertyService.findVoiceCatalog(),
        this.branchService.findAll(),
      ]);

      this.logger.debug(
        `📦 Property catalog size: ${propCatalog?.length || 0}`,
      );
      this.logger.debug(`🏢 Branch list size: ${branchList?.length || 0}`);

      const branches = branchList
        .filter((b: any) => b.status === 'active')
        .map((b: any) => {
          const label = [b.name, b.address, b.city].filter(Boolean).join(' ');
          return {
            id: String(b._id),
            label,
            ascii: this.foldAscii(label),
          };
        })
        .filter((b) => b.label.length > 2);

      const properties = propCatalog.map((p) => ({
        ...p,
        ascii: this.foldAscii(p.label),
      }));

      this.logger.debug(
        `Searching in ${properties.length} properties and ${branches.length} branches`,
      );
      this.logger.debug(`Query: "${tClean}"`);

      const fuzzy = this.tryFuzzyEntityNavigation(tClean, properties, branches);
      if (fuzzy) {
        this.logger.log(`✅ Fuzzy navigation hit: ${fuzzy.target}`);
        return fuzzy;
      }

      this.logger.debug(`❌ No fuzzy match found for: "${tClean}"`);
    } catch (e: any) {
      this.logger.error(
        `❌ Voice catalog / fuzzy step failed: ${e?.message || e}`,
      );
    }

    if (!this.groq) {
      return {
        action: 'speak',
        message:
          'Voice routing is not fully configured. Try a command like for rent, for sale, or branches.',
      };
    }

    const systemPrompt = `You are SmartProperty's voice assistant for CLIENT and GUEST users. You help users navigate the public site and client portal using voice.
You MUST respond with ONLY valid JSON — no markdown, no explanation, no backticks. Just raw JSON.

The user is currently on: "${currentPath}"

CLIENT ROUTES:
- /client-space → client dashboard
- /client-space/profile → profile
- /client-space/profile/edit → edit profile
- /client-space/saved-properties → saved properties
- /client-space/complaints → complaints list
- /client-space/complaints/new → new complaint
- /front-office → home / browse
- /front-office/search → all properties
- /front-office/search?type=rent → for rent
- /front-office/search?type=sale → for sale
- /front-office/branches → branch list
- /front-office/branches/{id} → one branch (IDs are unknown; use navigate only when user gave no specific unknown id — for named places fuzzy matching is already handled server-side)
- /front-office/property-detail/{id} → property detail (same note)

VOICE HOOKS — property page (clicks):
- open-schedule-visit, open-apply-modal, apply-browse-files, confirm-schedule-submit, confirm-apply-submit

VOICE HOOKS — profile page when currentPath includes /profile (My Profile):
- profile-edit-info → opens edit mode for name/phone/city
- profile-save-info → Save Changes
- profile-cancel-info → Cancel editing personal info
- profile-change-photo → opens image picker (change profile photo)
- profile-open-password → expands Change Password section
- profile-submit-password → Update Password button
- profile-cancel-password → cancel password form

PROFILE — fill targets (ids): va-profile-fullName, va-profile-phone, va-profile-city, va-profile-current-password, va-profile-new-password, va-profile-confirm-password
Flow: edit → fill fields one at a time → save. Change photo: voiceHook profile-change-photo then user picks image. Password: open-password → fill current → new → confirm → profile-submit-password.

If the user said a property or branch NAME but you cannot map it: ask them to repeat the name slowly or spell the area (speak). Do NOT tell them to use Search for voice — the app already tries to match titles and addresses. Do not invent IDs.

When returning {"action":"click"}, set "voiceHook" when possible.

PROPERTY PAGE — Visit modal: use action "fill" with target = element id (best) or placeholder:
- va-schedule-name, va-schedule-email, va-schedule-phone
- va-schedule-date (YYYY-MM-DD), va-schedule-time (HH:MM 24h)
- va-schedule-date2, va-schedule-time2 (optional second slot)
- Or placeholders: "Your name", "your@email.com", "+216 XX XXX XXX", labels "Slot 1 Date", "Slot 1 Time"

After opening the visit modal (voiceHook open-schedule-visit), guide one field at a time. Use "nextPrompt" in a fill action when helpful (optional); the app will speak it.

PROPERTY PAGE — Apply modal fields (prefer ids):
- va-apply-fullName, va-apply-email, va-apply-phone (required before submit)
- va-apply-age, va-apply-family (optional numbers)
- va-apply-occupation, va-apply-income, va-apply-notes
- User must pick a PDF: click voiceHook apply-browse-files, then confirm-apply-submit when ready

NAVIGATION PHRASES:
- rent / for rent → /front-office/search?type=rent
- buy / for sale → /front-office/search?type=sale
- go back → go_back

ACTIONS: navigate | click | fill | scroll | go_back | speak
Optional JSON keys: voiceHook, nextPrompt (string, short follow-up question).

RESPONSE EXAMPLES:
{"action":"click","voiceHook":"open-schedule-visit","message":"Opening visit scheduling."}
{"action":"fill","target":"va-schedule-date","value":"2026-04-15","message":"Date saved.","nextPrompt":"What time should we schedule?"}
{"action":"fill","target":"va-schedule-time","value":"14:30","message":"Time set."}
{"action":"click","voiceHook":"confirm-schedule-submit","message":"Sending your visit request."}
{"action":"click","voiceHook":"open-apply-modal","message":"Opening the application form."}
{"action":"fill","target":"va-apply-occupation","value":"Engineer","message":"Occupation set."}
{"action":"click","voiceHook":"apply-browse-files","message":"Opening file chooser. Please pick your PDF."}
{"action":"click","voiceHook":"confirm-apply-submit","message":"Submitting your application."}

RULES:
- ONE action per response.
- Property page: schedule visit → open-schedule-visit; apply → open-apply-modal; not on property page → speak to open a listing first.
- Profile page: "edit profile" / "change my details" → profile-edit-info; "change photo" / "profile picture" → profile-change-photo; "change password" → profile-open-password then fill password fields then profile-submit-password.
- NEVER include markdown or code fences. ONLY raw JSON.`;

    try {
      this.logger.log(`Interpreting navigation command: "${tClean}"`);

      const completion = await this.groq.chat.completions.create({
        messages: [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: tClean },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.25,
        max_tokens: 400,
      });

      const raw = completion.choices[0]?.message?.content || '';
      this.logger.log(`Raw Groq response: ${raw}`);

      let cleaned = raw.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned
          .replace(/^```(?:json)?\s*/, '')
          .replace(/```\s*$/, '')
          .trim();
      }

      try {
        const parsed = JSON.parse(cleaned);
        return {
          action: parsed.action || 'speak',
          target: parsed.target || undefined,
          value:
            parsed.value !== undefined && parsed.value !== null
              ? String(parsed.value)
              : undefined,
          message: parsed.message || 'Done.',
          voiceHook: parsed.voiceHook || undefined,
          nextPrompt: parsed.nextPrompt || undefined,
        };
      } catch (parseError) {
        this.logger.warn(`Could not parse Groq response as JSON: ${cleaned}`);
        return {
          action: 'speak',
          message: "I'm sorry, I couldn't understand that. Could you repeat?",
        };
      }
    } catch (error: any) {
      this.logger.error(
        `Error interpreting navigation command: ${error?.message || error}`,
      );
      throw error;
    }
  }
}
