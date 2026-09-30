Since AI has become remarkably easy to integrate in any application regardless of stack, it is an extraordinary shift to developers compared to what they have to go through for integrating a LLM to their application in past.

But this convenience introduces an interesting temptation - when a problem appears to be difficult, without the concern of efficiency, computation and not even the second thought on decision making we reach out to LLM's.

I have seen some of my friends use AI agents to search through a large collection of information, for classification tasks, and a whole lot more.. and will they pick a right model for the task, will they guardrail it **MY GOD** it's a long story for some other time.

I always tell them that:

**"The fact that the LLM could perform a certain task does not necessarily mean that LLM is the right system to approach it."**

I personally think that if we are limited ourselves with the thought that we are just making a prototype obviously our primary concern will tend to be: **"Will it work?"**

But if we open ourselves up a little bit to think that we are building an app for a broad range of users then we will be introduced to a lot more concepts like **efficiency, scalability, reliability, costs, concurrency, observability, retries, rate limiting etc.**

And that doesn't mean that you have to make your simple todo app as micro-service architecture with server and client side caching, but we have to know the **sweet spot** where the core software engineering principles, system design principles straight from our books can be useful to make our life's easier.

I will dive deep on what are the things that I have faced and what are the solutions that have been introduced in those scenarios in this Blog, even if it helps any one of you guys, I'll be so **Happy!**

## The LLM-First Approach :

As i said before we can see that most of the developers use LLM for variety of task, because a single model can Understand the user intent, reason over a provided context, classify and generate content, and it can even interact with external tools if provided. 

over the time this comfort has raised a question in all of our mind, *"why spend so much time building complex systems which will consume more time and energy? why dont we just call an LLM api and get it over with?"*

**It is a fairly reasonable question in the scope of prototype.**

But imagine that you are building a application where users need to search through a large collection of documents. Traditionally the process might involve building a indexing pipeline, choosing a search engine based on the requirement, implementing and supporting filtering and ranking the results. we can skip this whole process right through if we just pass the whole document to the LLM, and we can prompt it to retrieve them as a Json based on our liking right? RIGHTT? 

This is the exact Distinction between the person who contain themselves in the scope of prototype building and the one who is not, i call this **The LLM-First approach.**

Because in the scope of production we are not the only one using the application, so Most of the Models and Tools which we are using in a generous free tier wont be sufficient in production. apart from the costing we need to look at this in a software engineering perspective, is this solution efficient, can i produce a better work around faster than this? what happens when the model fails, will the model be used the way we are intended to?

I strongly believe that this is the place where we have to shift ourselves back from **" How can this be done by LLM" to "Wether this is a right place to use LLM"**

## From Prototype to Production :
Dont get me wrong, There is nothing inherently wrong in using LLM for getting things done in prototype, It will make a HUGE impact in hackathon builds, and small tools that we use it for ourselves.

But the Probl
