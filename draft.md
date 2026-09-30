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

But *el problema* is that prototype has a tendency to hide questions that production eventually forces, if we adapt ourselves for it then we will have a mindset of building a product, not just a project.

Because if you are the only one who's gonna use the application then you can build it however we want, Trust me when i build tools for me, i dont care about wether it loads under 200ms or not, but if you are building a application a product, and you have just vibe coded to use a LLM for a use case, apparently if the API call fails and makes 3 or 4 calls in the background behind the scenes.. you may not even notice.

imagine that your application receives 10,000 requests a day. and for half of the request your application cant handle the traffic or you're facing model availability issue, it's 25,000 model invocations.

Now increase the user base by a order of Magnitude. The Architecture itself hasn't changed, but the characteristics of the system has changed completely. using agents and LLM at scale is a vast concept and we are not covering that today, so i will keep it simple by saying we need to ask ourselves that whether we can these systems can be replaced by LLM. it is whether replacing them actually benefit us.

## Intelligence and Computation:

I believe that one of the easiest way to overuse the LLM is to confuse a problem that involves language with a problem that require intelligence. 

**They are not always the same.**

let us take a simple example:

we are writing a simple request to query *"Show me all the purchase order above certain amount, that has been placed this month"*

There is certainly language involved in this right, the user is not sending the actual db query, they are prompting the business logic in Natural language. But once the request is understood, the actual operation is *fairly straight forward*.

after understanding the context the whole process becomes relatively simple and comes down to : filter -> compare -> apply conditions -> sort and aggregate -> return 

None of this operation inherently require LLM. A DB is exceptionally good at this. 

***The same Distinction can appears in many other places.***

*we don't want LLM to decide whether the user has permission to access certain resource or not*
*we don't want LLM to retrieve a document that matches a particular query*

these are Computational problems, and we have systems that are designed to solve this. 

**On the other hand lets look at a text that says *im looking for customers who might be interested to buy the new product we planned to launch soon***

Here there is a TON of ambiguity. this is one of the use cases that LLM provide genuine value. 

In other words, understanding a problem and then executing the solution do not necessarily has to happen in the same system.

This is not a new idea, Software Engineering is built around this principle

*we don't ask the DB to render the data*
*we don't ask a frontend framework to manage the database transactions*
*we don't ask a cache manager to perform business logic*

we separate responsibilities, which allows each component to do its job efficiently. in the same manner LLM need not be treated differently just because it is capable of doing many things. 

i would like to share a interesting example here, which i believe will give us the proper understanding on what i'm trying to say here.

**Semantic Data Retrieval**. i'm sure most of the Guys just read that as RAG. *lol*

I suppose This is one of the common topics where people mix things up, to retrieve semantic data you dont have to manage a vector DB, and prompt an LLM to retrieve the data every time. we can break things down by just using a embedding model to convert the required fields to vectors, store them in a standard DB, whenever you need want to perform semantic search you just need to pass the input query to the same embedding model get the vector run a similarity search over two vectors. *badaBING badaBOOM!!*

You got the document that are relevant to the input that you have just gave, by cutting the cost off by 1/10th if not more!

