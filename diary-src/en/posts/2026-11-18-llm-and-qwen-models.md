---
title: "Under the Hood: How an LLM Works, and How to Choose a Qwen Model"
date: 2026-11-18T13:30:00+09:00
category: Notes
summary: "An LLM is a machine that computes the probability of the next token and picks one. How that calculation becomes capability across the three training stages, how tool calls turn into a loop, and when to pick 397B-A17B versus 27B from the Qwen2.5-to-3.8 line-up."
tags: [llm, qwen, moe, mixture-of-experts, gated-deltanet, reasoning, notes]
lang: en
translationKey: notes-llm-and-qwen-models
layout: post
---

In the previous post I wrote that the model is the engine and the harness is the steering wheel. That one was about the wheel: how to feed in rules, where to block tool execution, how to take procedures out when needed.

This post opens the engine. What an LLM actually computes, how that computation becomes "usable capability", and what the Qwen model names you keep seeing actually mean. It reads on its own, but the two are a pair. It continues from [The Model Is the Engine, the Harness Is the Steering Wheel](/diary/en/posts/2026-11-18-harness-layer-concept-and-usage/).

## What an LLM is, and how it works

One sentence: **an LLM is a function that takes the tokens in front of it and computes a probability distribution over the next token.** Nothing more, nothing less. The surprising capability is what comes out of repeating that simple calculation through a very large network on a very large amount of data.

### Next-token prediction — one piece of text at a time

Text is first split into tokens. A token is smaller than a word and larger than a character. "weather" might be one token, or "weath" and "er". The Qwen3.5 and 3.8 families have a vocabulary of about 248,320. The model's output is a score (logit) over that whole vocabulary, and softmax turns it into a probability distribution that sums to 1.

If the context is "the weather in Changwon today is", the probabilities for the next token look roughly like this. (The numbers are an illustration.)

- `clear` 42%, `cloud` 23%, `rain` 16%, `fog` 9%, the rest 10%

You pick one. The rule for picking is sampling. **Temperature** controls how sharp the distribution is. Lower concentrates on the top candidate; higher lets the tail get drawn. **Top-p** keeps only the point where cumulative probability reaches p. **Top-k** keeps the top k. All three decide "what stays a candidate".

The chosen token is appended to the context. Then the same calculation runs again. With "clear" appended, "skies" or "today" become likely. This structure, feeding its own output back in as input, is called **autoregressive**. A 300-token answer is 300 calculations.

Two facts from this matter in practice.

1. **The same question gets different answers.** Because a token is drawn from a distribution. If you need reproducibility, keep temperature near 0, and even then it is not exactly identical — batching and kernels nudge it slightly.

2. **Longer answers are slower and more expensive.** Token count is both the number of calculations and the billing unit. "Keep it short" is a cost constraint, not a matter of taste.

### Where the capability comes from — the three training stages

It is the same next-token prediction throughout; the stages differ in what counts as the right answer.

| Stage | Data | Objective | Result |
| --- | --- | --- | --- |
| Pre-training | Trillions of tokens: web, code, PDFs | Predict the next token | Base model (does not know instructions) |
| SFT | Human-written instruction–answer pairs | Conversational form and tone | Instruct model |
| RL | Verifiable answers, human preference | Get it right more often | Reasoning, aligned model |

**Pre-training** is closer to compression. To predict the next token over trillions of tokens, grammar, common sense, the rules of code and translation correspondences all have to end up inside the weights. That is the background to the announcements that Qwen2.5 was trained on 18 trillion tokens and Qwen3 on about 36 trillion. The output of this stage, the base model, predicts the next token well but does not know "answer the question". It is closer to a document continuation machine.

**SFT** (Supervised Fine-Tuning) teaches form. Instructions are paired with exemplary answers and the model learns to answer in a chat template. The system/user/assistant roles, the tone of a refusal, the habit of writing lists — this is where they come from. The "Instruct" models we meet through an API are the output of this stage.

**RL** changes the objective. SFT teaches "resemble the exemplary answer"; RL gives a reward for getting it right. The right answer to a maths problem, tests passing on code, a human's preference vote. Verifiable rewards (RLVR) are especially powerful because the model can find a solution better than the one a human wrote. The habit of thinking for a long time before answering also comes from this stage: if thinking longer earns more reward, that is the direction it learns.

The Qwen3.5 announcement describes extending this RL to "million-scale agent environments". For agent work where no human can write down every answer, the environment's success or failure signal becomes the reward.

### Tool calls — the model does not execute anything

An LLM's output is always text. It cannot write a file or run a command. Tool calling is the convention that routes around that limit.

First the tool list goes into the request: name, description, JSON Schema for the arguments.

```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Look up the current weather for a city. Use for questions about weather, temperature or precipitation.",
    "parameters": {
      "type": "object",
      "properties": {
        "location": { "type": "string", "description": "City name, e.g. Changwon" }
      },
      "required": ["location"]
    }
  }
}
```

The model emits a tool call instead of an answer: the text "call get_weather with location=Changwon". A program outside then makes the API call and puts the result back into context as a `role: tool` message. The model reads it and finishes the answer.

```python
messages = [
    {"role": "system", "content": "You are a weather assistant. Never guess a value the tool did not return."},
    {"role": "user", "content": "What's the weather in Changwon today?"},
]

# 1) the model picks a tool
res = client.chat.completions.create(model="Qwen/Qwen3.8-27B", messages=messages, tools=tools)
call = res.choices[0].message.tool_calls[0]

# 2) your code does the executing
result = get_weather(**json.loads(call.function.arguments))

# 3) put the result into context and call again
messages.append(res.choices[0].message)
messages.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(result, ensure_ascii=False)})
final = client.chat.completions.create(model="Qwen/Qwen3.8-27B", messages=messages, tools=tools)
```

A few things to remember in this loop.

- **The tool description is the prompt.** The only grounds the model has for picking a tool are `description` and the argument descriptions. Without "when to use it", the tool gets called at the wrong moment. Same as what I said about skill descriptions in the harness post.
- **Parallel calls only for independent work.** "Weather in Beijing and Shanghai" goes out as two calls at once. If the next argument depends on the previous result, the calls have to run in sequence.
- **Failure is a normal path.** Timeouts, 404s and empty results go into context as they are. The model choosing another tool, or fixing an argument and calling again, is the strength of this structure — which is why tool results should come back in a form a human could also read.
- **Execution permission lives outside the model.** What runs, and which tools need approval, is the harness's decision. However plausible the model's call, nothing happens if the executor refuses.

[![Next-token prediction, the three training stages, and the tool-call loop](/diary/assets/images/en/2026-11-18-llm-token-and-tool-loop.png)](/diary/assets/images/en/2026-11-18-llm-token-and-tool-loop.png)

*Top: the sampling loop over a vocabulary. Middle: pre-training → SFT → RL. Bottom: the model picks a tool, code executes it, the result returns to context.*

## The Qwen line-up at a glance

Qwen is Alibaba's model family. It started as Tongyi Qianwen in 2023 and continued through 2.5, 3, 3.5, 3.6 and 3.8. Names are usually `Qwen<generation>-<size>`, and MoE models carry `-A<active parameters>` after it. Read `Qwen3.5-397B-A17B` as "3.5 generation, 397B total, 17B active per token".

| Generation | When | Representative models | What changed |
| --- | --- | --- | --- |
| Qwen2.5 | 2024-09 | 0.5B–72B dense | 18T tokens, up to 128K context, tool calling settles in |
| Qwen3 | 2025-04 | 0.6B–32B, 30B-A3B, 235B-A22B | 36T tokens, 119 languages, hybrid thinking introduced |
| Qwen3-Next | 2025-09 | 80B-A3B | First experiment with Gated DeltaNet linear attention |
| Qwen3.5 | 2026-02 | 397B-A17B, 122B-A10B, 35B-A3B, 27B | Native multimodal, 201 languages, 3:1 hybrid |
| Qwen3.6 | 2026-04 | 35B-A3B, 27B | Stability, agentic coding, preserved thinking |
| Qwen3.7 | 2026-05–06 | Max, Plus, VLA | API-only generation (no open weights) |
| Qwen3.8 | 2026-08 | 2.4T-A95B, 27B | First Max-class open release; 27B under Apache 2.0 |

Qwen3.7 stands out. Max, Plus and VLA all shipped API-only, with no open weights. 27B coming back under Apache 2.0 in 3.8 means open-model users effectively skipped a generation.

### Dense vs MoE — how to read `total-Aactive`

Let me take one name apart: `Qwen3.5-397B-A17B`.

- **397B is the total parameter count.** All the weights have to be in memory.
- **17B is what is actually computed to make one token.** Of 512 experts, 10 plus one shared expert are switched on.

That is 4.3% of the whole. Why build it this way? Because it is a structure that "buys memory to save computation". To get 397B-class knowledge from a dense model you would compute 397B per token. In MoE the same knowledge sits in memory and only the needed part is computed per token. The price is GPU memory equal to the total.

| | Dense | Sparse MoE |
| --- | --- | --- |
| Computation | Proportional to total parameters | Proportional to active parameters |
| Memory | Total parameters | Total parameters (all resident) |
| Batching efficiency | Predictable | Varies with routing |
| Tuning difficulty | Low | Router and load balancing need care |
| Example | Qwen3.8-27B | Qwen3.5-397B-A17B |

MoE's cost lands on training and serving. If traffic piles onto one expert, one GPU gets busy; with small batches the active experts change every time and cache efficiency drops. So the lesson is not "more total parameters is always better" — look at concurrency and the memory budget together.

### Hybrid attention — why Gated DeltaNet is in there

Attention is the operation where tokens look at each other. The problem is that the cache grows as context grows. Standard attention has to hold the key/value of every past token, so the KV cache scales linearly with context length.

**Gated DeltaNet** (GDN) changes that point. Instead of storing the whole past, it updates a fixed-size state with a delta rule and decays it through a gate. State size is independent of context length, so the cache no longer grows linearly with long contexts. Qwen3-Next tried this structure first; 3.5 scaled it up in earnest.

Linear attention alone is not enough, though. It is weak at fetching a sentence that sat at a precise location (retrieval). So 3.5 mixes three GDN layers with one full-attention layer. 397B-A17B repeats this block 15 times for 60 layers; 27B repeats it 16 times for 64 layers. For 27B, only 16 layers are full attention, so it uses a quarter of the KV cache that all-full-attention layers would need.

In numbers: 27B holding 262,144 tokens in f16 KV is about 16GiB. If all 64 layers were full attention it would be 64GiB. That is where "27B, and 128K context on a 24GB card" comes from — with the caveats of quantising the KV cache to q8 and reducing the context.

[![Dense 27B versus sparse MoE 397B-A17B, and the Gated DeltaNet hybrid](/diary/assets/images/en/2026-11-18-qwen-dense-vs-moe-deltanet.png)](/diary/assets/images/en/2026-11-18-qwen-dense-vs-moe-deltanet.png)

*Left: dense 27B. Middle: sparse MoE 397B-A17B with 17B active. Right: the 3:1 GDN-to-full-attention block.*

## Two models side by side

The line-up is wide enough that in practice you end up choosing between two: 397B-A17B on a server and 27B on a desk. Rather than listing specs, here is what each is for.

### Qwen3.5-397B-A17B — the 397B you keep on a server

The first model of the 3.5 generation, released on 16 February 2026. Apache 2.0.

| Item | Value |
| --- | --- |
| Parameters | 397B total · 17B active per token |
| Experts | 10 of 512 routed + 1 shared |
| Layers | 60 (GDN 3 : Gated Attention 1) |
| Context | 262,144 native, extensible to about 1.01M |
| Input | Text, image, video, natively |
| Languages | 201 languages and dialects |
| Licence | Apache 2.0 |

Three things matter here.

**Native multimodal.** Not an image encoder bolted on afterwards — text and image tokens were trained together from the start. Understanding charts, documents and video is a basic capability, not an add-on.

**201 languages.** Up from 119 in the third generation. The vocabulary also grew to 250,000, so the same sentence takes fewer tokens. Fewer tokens means less cost and less latency.

**Throughput.** Per Alibaba's announcement, 8.6× Qwen3-Max's decoding throughput at 32K context and 19× at 256K; 3.5× and 7.2× against Qwen3-235B-A22B. This is the structural payoff of producing 397B-class knowledge with 17B active.

The headline scores, all from the vendor. Worth seeing.

| Benchmark | Score |
| --- | --- |
| MMLU-Pro | 87.8 |
| GPQA | 88.4 |
| LiveCodeBench v6 | 83.6 |
| SWE-bench Verified | 76.4 |
| Terminal Bench 2 | 52.5 |
| MCP-Mark | 46.1 |
| BrowseComp | 69.0–78.6 (depending on search strategy) |
| MathVision | 88.6 |

**When to use it.** Server workloads that need one model for large agents, complex reasoning, code and multimodality. Many requests, long contexts, and work that holds tools for a long time. Serving the same knowledge as a dense 397B costs far more computation per token, so if you can secure the GPUs, cost per unit of throughput drops a lot.

**What to watch.** Open weights, but not a model you run at home: the FP8 weights alone are around 400GB, so it needs a server-class multi-GPU setup. The 1M context is YaRN extension; native is 256K. And the 3.5 generation does not officially support prompt-level switches like `/think` and `/no_think` — you toggle it with request parameters.

### Qwen3.8-27B — the 27B on your desk

Released on 14 August 2026. A dense model built on the 3.5 architecture with a generation's worth of improvements, Apache 2.0.

| Item | Value |
| --- | --- |
| Parameters | 27.78B (27B on the card), all active |
| Layers | 64 (GDN 48 + Gated Attention 16) |
| FFN | Dense, intermediate 17,408 |
| Context | 262,144 native, 1M with YaRN |
| Input | Text, image, video, natively |
| Licence | Apache 2.0 |
| Memory | 16–19GB at 4-bit (one 24GB card) |

One thing to be clear about: the name says "27B dense", but the attention is the 3.5 hybrid unchanged. Dense means **not MoE**. Every token passes through the same FFN instead of a routed expert, so serving is simple and predictable even at small batch sizes. The KV cache, meanwhile, is a quarter of a full-attention 64-layer model because only 16 layers are full attention.

**Thinking control is this model's signature.** Three knobs.

- `enable_thinking` — on or off per request. On by default.
- `reasoning_effort` — `low`, `medium`, `xhigh`. The default is `xhigh`.
- `preserve_thinking` — keeps the previous turn's reasoning block in context. On by default.

On the API side you can also cap reasoning tokens with `thinking_budget`. When it hits the cap, the model stops reasoning and answers directly.

Sampling defaults differ by mode. Thinking mode: temperature 1.0, top-p 0.95, top-k 20. Non-thinking mode: temperature 0.7, top-p 0.8, top-k 20, presence penalty 1.5. Lowering temperature in thinking mode tends to push it into repetition, so following the model card's recommended values is safer.

The scores, again from the vendor.

| Benchmark | Score |
| --- | --- |
| Terminal Bench 2.1 | 73.0 |
| SWE-bench Pro | 61.7 |
| QwenSWEBench | 79.0 |
| LiveCodeBench v6 | 90.3 |
| GPQA Diamond | 89.2 |
| OSWorld-Verified | 84.3 |
| MathVision (with CI) | 94.6 |
| OmniDocBench 1.5 | 91.1 |

**When to use it.** The default for real coding, document and vision work on a local or single in-house GPU. Work where data must not leave the building, and where answers are needed with short latency and no network round trip. It runs at 4-bit on one 24GB card, and it was built to pair easily with coding-agent harnesses.

**What to watch.** The default is `xhigh`, so it tends to think too much. On simple questions a long reasoning block raises both latency and cost. In practice, set `low` or `medium` per kind of task. And 128K context at 24GB only fits with the KV cache quantised to q8; to use 262K fully, 48GB is more comfortable.

One more thing. Putting the two models' scores side by side, some items make 27B look better. But the exams are different. Terminal Bench **2** and **2.1**, SWE-bench **Verified** and **Pro**, are not the same test. The generations differ too — February and August. Comparing numbers horizontally needs the same benchmark, the same harness and the same context conditions.

[![Qwen3.5-397B-A17B and Qwen3.8-27B: specs, hardware, purpose](/diary/assets/images/en/2026-11-18-qwen-35-397b-vs-38-27b.png)](/diary/assets/images/en/2026-11-18-qwen-35-397b-vs-38-27b.png)

*Specs, hardware footprint and intended use for the two models, next to the small and the 2.4T options.*

### Between and above — the small models, and 2.4T

Those two are not the only choices. There are options between and above.

**Qwen3.5 small (0.8B–9B).** 9B, 4B, 2B and 0.8B arrived in March 2026. They keep the 3.5 generation's multimodal and context behaviour in sizes that run on a laptop or an edge device. Use them for bulk work where the answer's shape is fixed: classification, extraction, routing, short summaries. They also work well as a filter in front of a larger model.

**Qwen3.6's middle sizes.** 35B-A3B and 27B dense arrived in April 2026. With 3B active, the MoE runs at 4-bit even on a 24GB card, and the generation focuses on agentic coding. Choosing a 27B now means choosing between 3.6 and 3.8: 3.8 is the newest, 3.6 the proven one.

**Qwen3.8-2.4T-A95B.** The Max-class model released on 12 August 2026. 2.4T total, 95B active per token, 92 layers. Text only, and thinking cannot be turned off. The licence is not Apache 2.0 but the Qwen3.8-Max licence: products with more than 100 million monthly users or $20 million monthly revenue must show the model name in the UI, and a model-serving business above $50 million annual revenue needs a separate licence. A good example of "open weights" not meaning the same terms everywhere.

| Model | Size | Licence | Where it sits |
| --- | --- | --- | --- |
| Qwen3.5-0.8B–9B | 0.8B–9B dense | Apache 2.0 | Edge, laptops, high-volume simple work |
| Qwen3.6-35B-A3B | 35B total · 3B active | Apache 2.0 | 24–48GB workstation |
| Qwen3.8-27B | 27.78B dense | Apache 2.0 | Single 24GB GPU |
| Qwen3.5-397B-A17B | 397B total · 17B active | Apache 2.0 | Multi-GPU server |
| Qwen3.8-2.4T-A95B | 2.4T total · 95B active | Qwen3.8-Max | Large reasoning clusters |

## To think about: what actually travels on a call

By now the next question is: "so what actually goes back and forth when I call the API, and what changes when I turn thinking on?" This post won't settle it; it just lays out the material you need to judge.

### What a call looks like

Calling Qwen3.8-27B through an OpenAI-compatible API.

```python
from openai import OpenAI

client = OpenAI()  # base_url and api_key follow whichever gateway you use

completion = client.chat.completions.create(
    model="Qwen/Qwen3.8-27B",
    messages=[
        {"role": "system", "content": "You are a code reviewer. Cite findings as file:line only."},
        {"role": "user", "content": "Find the bugs in this diff.\n\n" + diff},
    ],
    extra_body={
        "chat_template_kwargs": {
            "enable_thinking": True,     # default
            "preserve_thinking": True,   # default
        },
    },
    reasoning_effort="medium",           # xhigh · medium · low
    stream=True,
    stream_options={"include_usage": True},
)
```

Two kinds of chunks come back interleaved in the stream: `reasoning_content` (the reasoning) and `content` (the answer). If you only want to show the answer, drop the first — but dropping it does not remove it from **billing or latency**. Reasoning tokens are output tokens.

### Where cost and latency grow

Split the tokens into three parts and the arithmetic gets easy.

| Stage | What it measures | With thinking on |
| --- | --- | --- |
| Prefill | Processing the input context at once | Grows with context length (more if reasoning blocks stay) |
| Decode | Generating tokens one at a time | Grows linearly with reasoning tokens |
| Round trips | Number of tool calls | Falls when failures and retries fall |

The key point is that **decode is proportional to token count**. 600 tokens of reasoning plus 200 of answer is four times the generation of the answer alone. Prefill, by contrast, processes the prompt in parallel, so in many workloads producing more tokens hurts latency more than lengthening the context slightly.

Output is usually priced above input. Qwen3.7-Plus, for example, is published at $0.40 per million input tokens and $1.20 per million output — three times. So long reasoning costs more than a slightly longer input.

### Why preserve_thinking defaults to on

In a multi-turn agent, throwing away the reasoning block every turn is waste: turn two has to redo the judgement of turn one. `preserve_thinking` keeps the previous assistant message's reasoning in context so the same deliberation isn't repeated. Qwen's documentation also notes that reusing the KV cache improves inference efficiency.

The price is context. As reasoning blocks accumulate, the input grows, along with prefill cost and memory. So the call is:

- **Work whose reasoning is still needed next turn** — agents, debugging, multi-step edits. Better to leave it on.
- **Work that is independent per turn** — classification, summaries, one-shot queries. Better to turn it off and shrink the context.

### Does lowering effort really make it faster?

Here is the counter-intuitive part. Qwen's documentation says: **in multi-turn agents, lowering reasoning effort does not always reduce total completion time.** Each turn answers faster, but if thinner analysis raises failures and retries, total latency and token spend can grow.

Which means effort is not a performance knob but **a risk knob**. Where the answer is uniquely determined (tests passing, format conversion), low effort wins. Where exploration and judgement are needed (the cause of a bug, a design choice), high effort lowers total cost.

[![Call flow and reasoning tokens for non-thinking and thinking, plus the four control knobs](/diary/assets/images/en/2026-11-18-hybrid-thinking-flow.png)](/diary/assets/images/en/2026-11-18-hybrid-thinking-flow.png)

*Non-thinking vs thinking token flow, and the four knobs — enable_thinking, reasoning_effort, preserve_thinking, thinking_budget.*

### Five things to think about

Rather than prescribing answers, these are questions to answer yourself before the next exercise.

1. **In my work, which tasks need thinking and which only need the right form?** Once you can split them, `enable_thinking` and `reasoning_effort` can be set per kind of work. Are you still sending everything on defaults?
2. **The tool description is the model's only grounds for choosing a tool.** Are any of your tools named but thinly described? Did you write when to use it, rather than what it does?
3. **Where is parallel tool calling safe?** Reads can go in parallel; writes, deletes and payments must run in sequence. Is the harness enforcing that boundary?
4. **Are you actually using long context, or just paying for it?** Being able to pass 256K and needing 256K are different. Most work is cheaper and more accurate narrowed by retrieval.
5. **What separates the work where 27B is enough from the work that needs 397B?** Concurrent requests, context length, whether data may leave the building, and latency tolerance. Those four usually give the answer.

## To finish

Summed up:

- An LLM is a function that computes the probability of the next token and picks one; the length of the answer is the number of calculations.
- Capability comes from three stages: pre-training (compression), SFT (form), RL (reasoning and alignment).
- A tool call is a loop the model chooses and the harness executes. The model still only emits text.
- Qwen moved from 2.5 to 3.8 by making hybrid attention and native multimodality the baseline, and the `total-Aactive` notation makes that structure visible.
- 397B-A17B on a server, 27B on a desk. Both Apache 2.0, but different places to sit and different memory budgets.
- Thinking is not free. Tuning the four knobs per kind of work is the next step.

In the previous post I said the next one would be a hands-on session adding skills with `npx`; I swapped the order a little, because without the model side settled it is hard to see why skills are needed at all. Next I'll actually call Qwen3.8-27B, attach two tools and turn the loop once. Then we go back to the harness exercise.

One thing to do today is enough: read the name of the model you are using. What the `A` in `397B-A17B` means, whether your model is dense or MoE, whether thinking is on by default. Checking those three makes the next choice much less of a guess.
