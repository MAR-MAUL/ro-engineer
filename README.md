# RO Engineer

RO desalination engineering portal for process-flow visualization, PX/HPP/CP flow balancing, preliminary energy calculations, and saved design cases.

Architecture:
- Source: GitHub
- Hosting target: Netlify site `ro-engineer`
- Database/Auth: Supabase project `ro-engineer` in ap-southeast-1

Process arrangement:
Bag filter outlet splits to HPP and PX LP IN. PX HP OUT flows to the circulation pump and rejoins HPP discharge at the RO inlet header. RO concentrate flows to PX HP IN. PX LP OUT and any direct vessel reject flow to reject/drain.
