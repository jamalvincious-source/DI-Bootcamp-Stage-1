magician_names = ["Harry Houdini", "David Blaine", "Criss Angel"]


def show_magicians(magician_names):
	for magician in magician_names:
		print(magician)


def make_great(magician_names):
	for index in range(len(magician_names)):
		magician_names[index] = f"{magician_names[index]} the Great"


make_great(magician_names)
show_magicians(magician_names)
