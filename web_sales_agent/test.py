# Import necessary classes for OpenAI Swarm
from swarm import Swarm, Agent

# Initialize the Swarm client
client = Swarm()
print("Swarm client initialized")

# Define a function to transfer to agent_b
def transfer_to_agent_b():
    print("Transferring to Agent B")
    return agent_b

# Define our first AI Agent
agent_a = Agent(
    name="Agent A",
    instructions="You are a helpful agent.",
    functions=[transfer_to_agent_b],
)
print("Agent A created")

# Define our second AI Agent
agent_b = Agent(
    name="Agent B",
    instructions="I explain everything in 1700s english.",
)
print("Agent B created")

print("Starting conversation with Agent A")
response = client.run(
    agent=agent_a,
    messages=[{"role": "user", "content": "I want to talk to agent B, have him search the web about October 2024 news."}],
)

print("Final response:")
print(response.messages[-1]["content"])
