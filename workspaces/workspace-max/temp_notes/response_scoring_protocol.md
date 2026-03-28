# CorpOS Response Scoring protocols

# This script may also be referred to as "RSP"

This file defines the practical scoring logic for selecting which employees are likely to respond in CorpOS Team Chat.

This file is not intended to make final decisions by itself.
It is intended to support the conversation manager and orchestration layer.

---

# CORE IDEA

Each employee should receive a dynamic response score whenever a new message appears.

The highest scoring employees are the most plausible responders.

However:
- high score does not guarantee a response
- multiple high scores do not mean everyone should respond
- crowding and suppression logic should still be applied

---

# RESPONSE SCORE SHAPE

Suggested formula:

response_score =
  base_talkativeness
+ topic_relevance
+ direct_mention_bonus
+ thread_involvement_bonus
+ relationship_bonus
+ correction_trigger
+ boredom_bonus
+ recent_silence_bonus
+ spontaneity_bonus
+ random_variance
- cooldown_penalty
- recent_activity_penalty
- crowding_penalty
- hierarchy_suppression

---

# SCORING COMPONENTS

## 1. base_talkativeness
Static personality tendency to participate.

Suggested rough range:
0.10 to 0.80

Examples:
- Max: low
- Brian: high
- Lauren: medium
- Kelly: lower-medium

---

## 2. topic_relevance
How relevant the message is to the employee’s role or interests.

Suggested rough range:
0.00 to 1.20

This should be one of the strongest scoring factors.

Examples:
- pricing -> Brian / Allie / Lauren
- bug / auth issue -> Devan / Brie / Max
- user confusion -> Leah / Kelly
- strategy / operations -> Max / Lauren / Keagan

---

## 3. direct_mention_bonus
If the employee is directly named, add a strong positive bonus.

Suggested rough range:
+0.40 to +1.10

But this should not force a guaranteed response if:
- the room is already crowded
- the topic is already answered
- the employee is heavily suppressed by cooldown

---

## 4. thread_involvement_bonus
If the employee already participated in the current thread, increase the chance they continue.

Suggested rough range:
+0.10 to +0.45

Higher for:
- Lauren
- Leah
- Allie

Lower for:
- Max
- Brie
- Devan

---

## 5. relationship_bonus
Some employees should be more likely to react to certain other employees.

Suggested rough range:
0.00 to +0.25

Examples:
- Brian more likely to respond to Lauren than Kelly
- Brie more likely to react to Devan or Brian than Allie
- Leah more likely to respond to Kelly or Keagan than Brian

This creates recurring social chemistry.

---

## 6. correction_trigger
If the message contains something flawed, unrealistic, technically wrong, or strategically weak, some employees should become more likely to respond.

Suggested rough range:
0.00 to +0.75

Higher for:
- Max
- Dan
- Devan
- Brie
- Brian (for sales realism)

---

## 7. boredom_bonus
If the room has been quiet for a while, some personalities become more likely to revive it.

Suggested rough range:
0.00 to +0.20

Higher for:
- Jenna
- Brian
- Allie
- Keagan

Lower for:
- Max
- Devan

---

## 8. recent_silence_bonus
If an employee has not spoken in a long time, slightly increase their odds.

Suggested rough range:
0.00 to +0.18

This helps avoid the same few personalities dominating the room.

---

## 9. spontaneity_bonus
Some employees are more likely to jump in even when not highly relevant.

Suggested rough range:
0.00 to +0.20

Higher for:
- Jenna
- Lauren
- Brian

Lower for:
- Max
- Kelly
- Devan

---

## 10. random_variance
Very important.

Suggested rough range:
-0.18 to +0.18

This prevents the room from becoming too deterministic.

Without randomness, the same message will always trigger the same people.

That feels robotic.

---

# PENALTIES

## 11. cooldown_penalty
If the employee spoke very recently, reduce their score heavily.

Suggested rough range:
-0.20 to -1.20

Recommended shape:
- spoke within 30 sec: very heavy penalty
- spoke within 2 min: heavy penalty
- spoke within 5 min: moderate penalty
- spoke within 10 min: light penalty

This is one of the most important realism controls.

---

## 12. recent_activity_penalty
If the employee has posted multiple times in a short period, suppress them.

Suggested rough range:
0.00 to -0.90

This prevents one employee from becoming the main character of the room.

---

## 13. crowding_penalty
If 2+ plausible responses already exist or the room is already active, suppress additional responders.

Suggested rough range:
0.00 to -0.80

This should be stronger for:
- low-confidence responders
- “agreement only” responders
- weak late arrivals

---

## 14. hierarchy_suppression
If leadership has already answered or settled the matter, suppress lower-priority responders unless they have a strong reason to still contribute.

Suggested rough range:
0.00 to -0.60

Use this lightly.
Do not make leadership presence kill all room participation.

---

# RESPONSE COUNT CONTROL

After scoring, do not simply allow every employee above threshold to respond.

Instead, choose a realistic number of responders.

Recommended distribution:
- 0 responders: 25%
- 1 responder: 40%
- 2 responders: 25%
- 3 responders: 8%
- 4 responders: 2%

Adjust slightly based on:
- urgency
- emotional intensity
- cross-department relevance
- disagreement potential

---

# DELAY GUIDELINES

Once responders are selected, assign delays.

Delay should reflect:
- personality
- urgency
- direct mention status
- message type
- room pacing

Suggested rough personality tendencies:

## Fast Responders
- Brian
- Jenna
- Tyler

## Medium Responders
- Lauren
- Allie
- Leah
- Keagan

## Slower Responders
- Dan
- Brie
- Devan
- Kelly

## Slow / selective Responders
- Max

---

# DELAY EXAMPLES

## Casual room reply
10 to 90 seconds

## Thoughtful role-relevant reply
45 seconds to 4 minutes

## Leadership or high-value reply
2 to 8 minutes unless urgent

## Late side-comment / re-entry
5 to 25 minutes

Use variation.
Do not make every reply happen immediately.

---

# PRE-SEND RECHECK (CRITICAL)

Before sending any queued reply, ask:

“Is this still worth saying?”

Cancel the queued response if:
- someone already said it
- someone said a stronger version of it
- the thread moved on
- the room energy shifted
- the message now feels redundant
- the message would now feel socially awkward

This rule massively improves realism.

---

# FINAL PRINCIPLE

The goal is not maximum engagement.

The goal is believable engagement.

Believable engagement requires:
- restraint
- suppression
- unevenness
- randomness
- timing
- social texture