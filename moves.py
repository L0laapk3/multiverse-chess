from itertools import permutations
from math import copysign

# I used variations of this code to generate the move lists in piece.js.

all = []
for b in ((2, 1, 0, 0), (-2, 1, 0, 0), (2,-1, 0, 0), (-2,-1, 0, 0)):
	for a in permutations(b):
		if a not in all:
			all.append(a)
sorted(all)
for a in all:
	print("yield Vec4(" + ",".join(map(lambda x: ("" if x < 0 else " ") + str(x), a)) + ");")