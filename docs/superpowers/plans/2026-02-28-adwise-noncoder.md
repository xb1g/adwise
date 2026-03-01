# Adwise — Non-Coder: Design, Content & Demo Plan

> This plan has no code. Follow the tasks in order. Deliverables are marked with deadlines relative to hackathon start (Hour 0).

**Goal:** Deliver Figma mockups, elder personas, TTS voice clips, pitch deck, and a rehearsed demo script so the team presents a polished, compelling product.

**Your four workstreams run in parallel:**
1. Design — Figma mockups handed off to devs early
2. Content — Elder personas delivered to Dev 3 on Hour 0
3. Voice — TTS audio clips for seeded profiles
4. Pitch — Deck + demo script finished by Hour 16

---

## Workstream 1: Content (Due: Hour 0–1)

**This is the most time-critical deliverable. Dev 3 needs elder personas immediately to seed the database.**

### Task 1: Write 6–8 elder personas

Each persona needs these fields in a simple document (Google Doc, Notion, or plain text):

```
Name: [First name only]
Age range: [50s / 60s / 70s / 80s+]
Country of origin (if applicable): [...]
Life areas covered: [pick 2–3: career, immigration, startup, marriage, divorce,
                     grief, financial-recovery, creativity, identity, family,
                     health, education, reinvention]

Bio (2 sentences, third person):
[e.g. "Moved from Mexico at 35 with nothing, rebuilt her life as a single mother.
Now retired, she mentors women navigating immigration and career transitions."]

Story transcript (3–5 paragraphs, first person, spoken voice):
[Write as if they are speaking out loud — informal, emotional, specific.
Include: what happened, the hardest moment, what changed, what they learned.]

3 wisdom snippets (quotable 1-sentence insights):
1. "..."
2. "..."
3. "..."

Preview text (1 sentence, max 20 words, makes a young person desperate to hear more):
"..."

Tags (4–6 keywords):
[e.g. immigration, single-parent, career-change, resilience]
```

**Suggested personas to cover:**
- An immigrant who rebuilt their career in a new country
- A startup founder who failed (and recovered)
- Someone who left a long marriage
- A person who changed career after age 50
- Someone who lost everything financially and rebuilt
- A widower who found new purpose after grief
- A parent who had to distance themselves from family expectations
- A creative who gave up art for decades and came back to it

- [ ] Write all 6–8 personas in a shared Google Doc
- [ ] Share the doc link with Dev 3 **before Hour 1**
- [ ] Dev 3 will paste the content into their seed script — you don't need to do anything technical

---

## Workstream 2: Voice Clips (Due: Hour 4–6)

**Used by Dev 3 to attach audio to seeded profiles. Also used in the demo for judges to "hear" elders.**

### Task 2: Generate TTS voice clips with ElevenLabs

- [ ] Go to [ElevenLabs.io](https://elevenlabs.io) → Speech Synthesis

- [ ] For each elder persona, select a distinct voice that matches their character:
  - Elderly woman: try "Matilda", "Dorothy", or "Grace"
  - Elderly man: try "George", "Clyde", or "Arnold"
  - Use different voices for each elder so they feel distinct

- [ ] Paste the **story transcript** text (not the full persona — just the transcript paragraphs)

- [ ] Generate audio, download as MP3

- [ ] Name each file clearly: `01-maria-santos.mp3`, `02-robert-chen.mp3`, etc.

- [ ] Upload all files to a shared Google Drive folder and share the link with Dev 3

**Note:** These clips are for the demo seeded profiles. The actual app records real voices.

---

## Workstream 3: Design (Due: Hour 4)

**Figma mockups guide Dev 1 and Dev 2. Keep them simple — devs need direction, not pixel-perfect specs.**

### Task 3: Create Figma mockups for 5 key screens

**Design system to follow (from existing codebase):**
- Background: `#FDFFF5` (off-white)
- Text: `#111` (near black)
- Accent: `#BFFF00` (yellow-green)
- Font: Orbit (use closest Figma equivalent: Space Grotesk or similar monospace)
- Style: clean, minimal, slightly brutalist — thick borders, no rounded corners, no gradients

**5 screens to mock up:**

**1. Role Selection**
- "adwise" logo top left
- Two large cards stacked vertically:
  - "I have wisdom" (dark background)
  - "I need wisdom" (accent #BFFF00 background)
- Each card: title + 1 line description

**2. Voice Recording**
- Title: "Tell your story"
- Center: large circle with pulsing ring (accent color) containing a dark record button
- Below: status text ("Hold to record")
- Minimal, atmospheric

**3. Processing / Structuring**
- Dark (#111) full-screen
- Center: spinner or animated dots in accent color
- Text: "Structuring your wisdom..."
- Feels like something meaningful is happening

**4. Match Results**
- Title: "Your top matches"
- Italic subtitle showing the problem text
- 3 card previews visible:
  - Card 1 (Best Match): accent border, "Best Match" badge, rank #1 circle, life area chips, bio snippet, match reason in italic, "Read their story →"
  - Cards 2–3: same structure, thinner border

**5. Elder Detail**
- Back link top
- Elder avatar circle + age range + life area chips
- "Why you matched" box in light green: match reason
- Bio paragraph
- "Their story" section: preview text + blurred/blocked area + "Unlock full story — $2" button
- Bottom: large accent "Book a 30-min conversation — $30" button

- [ ] Create all 5 screens in Figma
- [ ] Share the Figma link with Dev 1 and Dev 2 by **Hour 4**
- [ ] Be available for quick questions — don't disappear after handoff

---

## Workstream 4: Pitch & Demo (Due: Hour 16)

### Task 4: Build the pitch deck

**Format:** 8–10 slides, presentation tool of your choice (Figma, Google Slides, Canva)

**Slide structure:**

```
1. Hook slide
   "What if you could ask your exact problem to someone who has already lived it?"
   [No bullet points. Just the question.]

2. The problem
   - Young people face real crises (career, startup, relationships, immigration)
   - Advice from peers is guesswork
   - Google gives information. Not wisdom.
   - The people who have the answers are not findable.

3. The solution — one sentence
   "Adwise matches your problem to elders who have lived the exact experience —
   through AI-powered voice story matching."

4. How it works (3 steps)
   Step 1: Elders record voice stories → AI structures them into wisdom profiles
   Step 2: You describe your problem → AI matches you to top 5 elders
   Step 3: Read their story or book a real conversation

5. Demo slide
   [Just the word DEMO — you'll do the live demo here]

6. The market
   - 55M Americans over 65 with lived experience to share
   - 72M millennials + Gen Z facing career/life crises
   - $4.5B life coaching market (mostly generic)
   - No platform exists for lived-experience matching

7. Business model
   - Story unlocks: $2–5 per story
   - Conversation bookings: $30–80 per session (platform takes 20%)
   - Elder subscription: free to publish, premium analytics
   - Target: $50K MRR at 5,000 monthly active seekers

8. Why now / why us
   - AI makes matching possible at scale
   - Voice interfaces lower the barrier for elders (not apps they need to learn)
   - ElevenLabs makes transcription seamless
   - Built in 24 hours — imagine what we do with a month

9. Ask
   [What you want from judges — feedback, connections, prize, etc.]
```

- [ ] Complete all slides by **Hour 16**

### Task 5: Write the demo script

The demo is the most important part. Rehearse it until it feels natural.

**Script (3 minutes):**

```
[Device 1 — Elder side]

"Meet Maria. She's 64. She immigrated from the Philippines at 35 with nothing.
She's going to share her story with Adwise."

→ Open app → tap "I have wisdom"
→ Show elder setup: tap "60s", tap "immigration" + "career"
→ Tap "Record my story"

"Maria holds the button and speaks for about 60 seconds."

[Speak the first paragraph of Maria's transcript out loud, naturally]

→ Release button

"Watch what happens."

→ Show "Structuring your wisdom..." loading screen
→ Wait for the profile to appear

"In seconds, AI has turned Maria's voice into a structured wisdom profile —
life areas, key insights, quotable moments. She didn't fill out a form.
She just told her story."

---

[Switch to Device 2 — Seeker side]

"Now meet someone who needs her.
A 27-year-old. Scared to quit his job. Has a family. Parents think he's crazy."

→ Tap "I need wisdom"
→ Tap "Career confusion"
→ Type: "I want to start a company but I'm terrified of losing my stable income.
         I have a family to support. Everyone thinks I'm being irresponsible."
→ Tap "Find my elders"

"Adwise analyzes the problem. Not keywords — the emotional reality of it."

→ Show top 5 match cards loading

"Five elders who have lived exactly this. Not motivational speakers.
Not coaches with a certification. People who were exactly where you are."

→ Tap the #1 match

"Maria is the best match. And here's why: [read match reason aloud]"

→ Show her profile, her wisdom snippets
→ Tap "Unlock full story"

"For $2, he reads everything. Or..."

→ Tap "Book a 30-min conversation"

"For $30, he talks to her directly."

---

"That's Adwise. The world's first marketplace for lived experience.
Not optimized for engagement. Optimized for wisdom."
```

- [ ] Write the final demo script in a notes app on your phone
- [ ] Rehearse the full demo **at least 3 times** with the team before judging
- [ ] Time yourself — target 2:45–3:00 minutes

### Task 6: Pre-demo checklist

Run through this 30 minutes before judging:

- [ ] Both devices charged and signed into test accounts
- [ ] Test accounts: one elder account (already completed setup + recording), one seeker account
- [ ] Elder account has a published wisdom profile visible
- [ ] Seeker account: start from problem screen (don't reuse a previous match)
- [ ] App running in iOS simulator or physical device (not Expo Go if possible)
- [ ] Pitch deck open on a separate laptop, presented in full screen
- [ ] Confirm: match results load in under 10 seconds
- [ ] Confirm: "Structuring your wisdom" completes successfully on stage
- [ ] Confirm: elder detail screen scrolls smoothly to the book button
- [ ] Know your fallback: if live recording fails, have a pre-seeded elder ready to show the seeker flow

---

## Summary Timeline

```
Hour 0:    Hand elder persona doc to Dev 3 (CRITICAL)
Hour 1:    Start Figma mockups
Hour 4:    Share Figma with Dev 1 + Dev 2
Hour 4–6:  Generate TTS voice clips, share with Dev 3
Hour 6:    Start pitch deck
Hour 16:   Pitch deck complete, demo script written
Hour 16–22: Demo rehearsals with full team
Hour 22:   Final pre-demo checklist
```
