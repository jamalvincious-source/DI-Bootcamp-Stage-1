family = {"rick": 43, "beth": 13, "morty": 5, "summer": 8}
total_cost = 0

for name, age in family.items():
	if age < 3:
		ticket_price = 0
	elif age <= 12:
		ticket_price = 10
	else:
		ticket_price = 15

	total_cost += ticket_price
	print(f"{name}: ${ticket_price}")

print(f"Total cost: ${total_cost}")
Looping through dictionaries
Conditionals
Calculations


Instructions
Write a program that calculates the total cost of movie tickets for a family based on their ages.

Family members’ ages are stored in a dictionary.
The ticket pricing rules are as follows:
Under 3 years old: Free
3 to 12 years old: $10
Over 12 years old: $15


Family Data:

family = {"rick": 43, 'beth': 13, 'morty': 5, 'summer': 8}


Loop through the family dictionary to calculate the total cost.
Print the ticket price for each family member.
Print the total cost at the end.


Bonus:

Allow the user to input family members’ names and ages, then calculate the total ticket cost.



