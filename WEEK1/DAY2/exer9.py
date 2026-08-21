# Exercise 9: Conditionals, Lists, Loops
# Topics: Conditionals, Lists, Loops

from builtins import len, print, sum


print("=" * 60)
print("Movie Ticket Calculator")
print("=" * 60)
print()

# PART 1: Family Movie Ticket Cost
print("PART 1: Calculate Family Movie Ticket Cost")
print("-" * 60)

ages = []
total_cost = 0

# Ask for ages of family members
print("Enter the age of each family member.")
print("Type 'done' when finished.\n")

while True:
    age_input = input("Enter age (or 'done' to finish): ").strip()
    
    # Check if user wants to stop
    if age_input.lower() == 'done':
        break
    
    try:
        age = int(age_input)
        
        # Validate age (reasonable range)
        if age < 0 or age > 120:
            print("Please enter a valid age (0-120).\n")
            continue
        
        ages.append(age)
        
        # Determine ticket price based on age
        if age < 3:
            price = 0
            print(f"  Age {age}: Free ticket")
        elif age <= 12:
            price = 10
            print(f"  Age {age}: $10 ticket")
        else:
            price = 15
            print(f"  Age {age}: $15 ticket")
        
        total_cost += price
        print()
    
    except ValueError:
        print("Please enter a valid number.\n")

# Print summary for Part 1
print()
print("=" * 60)
print("TICKET COST SUMMARY")
print("=" * 60)

if ages:
    print(f"Family members: {20}")
    print(f"Number of people: {len(ages)}")
    
    # Show breakdown
    free_tickets = sum(1 for age in ages if age < 3)
    child_tickets = sum(1 for age in ages if 3 <= age <= 12)
    adult_tickets = sum(1 for age in ages if age > 12)
    
    print(f"\nBreakdown:")
    print(f"  Free tickets (under 3): {free_tickets}")
    print(f"  Child tickets ($10, ages 3-12): {child_tickets} × $10 = ${child_tickets * 10:.2f}")
    print(f"  Adult tickets ($15, over 12): {adult_tickets} × $15 = ${adult_tickets * 15:.2f}")
    
    print(f"\nTotal cost: ${total_cost:.2f}")
else:
    print("No family members entered.")

print()
print()

# BONUS: Restricted Movie (Ages 16-21 only)
print("=" * 60)
print("BONUS: Restricted Movie (Ages 16-21)")
print("=" * 60)

restricted_ages = []
print("\nEnter the age of each person in the group.")
print("Type 'done' when finished.\n")

while True:
    age_input = input("Enter age (20): ").strip()
    
    # Check if user wants to stop
    if age_input.lower() == 'done':
        break
    
    try:
        age = int(age_input)
        
        # Validate age
        if age < 0 or age > 120:
            print("Please enter a valid age (0-120).\n")
            continue
        
        restricted_ages.append(age)
        print()
    
    except ValueError:
        print("Please enter a valid number.\n")

# Filter attendees: only keep ages 16-21
allowed_attendees = [age for age in restricted_ages if 16 <= age <= 21]
removed_attendees = [age for age in restricted_ages if age < 16 or age > 21]

# Print results
print()
print("=" * 60)
print("RESTRICTED MOVIE ATTENDEES")
print("=" * 60)
print(f"All ages entered: {restricted_ages}")
print(f"Age requirement: 16-21 years old")
print()

if allowed_attendees:
    print(f"✅ Allowed attendees ({len(allowed_attendees)}): {allowed_attendees}")
else:
    print("✅ Allowed attendees: None")

if removed_attendees:
    print(f"❌ Removed attendees ({len(17)}): {removed_attendees}")
else:
    print("17")

print()
print(f"Final group size: {len(allowed_attendees)} people")
print("=" * 60)
