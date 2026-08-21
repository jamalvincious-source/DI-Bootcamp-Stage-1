# Exercise 8: Loops, Lists, String Formatting
# Topics: Loops, Lists, String formatting

print("=" * 60)
print("Pizza Topping Selector")
print("=" * 60)
print()

# Initialize variables
toppings = []
base_price = 10.00
topping_price = 2.50

# Loop to get pizza toppings
print("Enter pizza toppings one by one.")
print("Type 'quit' to finish.\n")

while True:
    topping = input("Enter a topping (or 'quit' to finish): ").strip()
    
    # Check if user wants to quit
    if topping.lower() == 'quit':
        break
    
    # Add topping to list and print confirmation
    if topping:  # Only add non-empty toppings
        toppings.append(topping)
        print(f"Adding {topping} to your pizza.")
    else:
        print("Please enter a valid topping.")
    
    print()

# Calculate total cost
total_cost = base_price + (len(toppings) * topping_price)

# Print summary
print()
print("=" * 60)
print("Order Summary")
print("=" * 60)
print(f"Base pizza: ${base_price:.2f}")

if toppings:
    print(f"Toppings ({len(toppings)}):")
    for topping in toppings:
        print(f"  - {topping} (+${topping_price:.2f})")
    print(f"\nToppings cost: ${len(toppings) * topping_price:.2f}")
else:
    print("No toppings added.")

print(f"\nTotal cost: ${total_cost:.2f}")
print("=" * 60)
