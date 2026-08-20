# Exercise: Vowels and Consonants
# Instructions:
# 1. Create a string of all the letters in the alphabet
# 2. Loop over each letter and print whether it's a vowel or consonant

print("=" * 60)
print("Alphabet: Vowels vs Consonants")
print("=" * 60)
print()

# Method 1: Using a string literal
print("Method 1: Using string literal")
print("-" * 60)
alphabet = "abcdefghijklmnopqrstuvwxyz"
vowels = "aeiou"

for letter in alphabet:
    if letter in vowels:
        print(f"The letter '{letter}' is a vowel")
    else:
        print(f"The letter '{letter}' is a consonant")

print()
print()

# Method 2: Using string.ascii_lowercase
print("Method 2: Using string module")
print("-" * 60)
import string

for letter in string.ascii_lowercase:
    if letter in vowels:
        vowel_status = "vowel"
    else:
        vowel_status = "consonant"
    print(f"The letter '{letter}' is a {vowel_status}")

print()
print()

# Method 3: Summary with counts
print("=" * 60)
print("Summary Statistics")
print("=" * 60)
vowel_count = sum(1 for letter in alphabet if letter in vowels)
consonant_count = len(alphabet) - vowel_count

print(f"Total letters: {len(alphabet)}")
print(f"Vowels: {vowel_count} ({vowels})")
print(f"Consonants: {consonant_count}")
print()
print(f"Vowel letters: {', '.join([letter for letter in alphabet if letter in vowels])}")
print(f"Consonant letters: {', '.join([letter for letter in alphabet if letter not in vowels])}")
