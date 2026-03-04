export interface MissionTemplate {
  title: string;
  instructions: string;
  powerValue: number;
  recurringDaily: boolean;
}

export interface MissionTemplatePack {
  id: string;
  name: string;
  description: string;
  missions: MissionTemplate[];
}

export const MISSION_TEMPLATE_PACKS: MissionTemplatePack[] = [
  {
    id: "morning-routine",
    name: "Morning Routine",
    description: "Fast-start missions to begin the day.",
    missions: [
      {
        title: "Sunrise Suit-Up",
        instructions: "Get dressed for the day, including socks.",
        powerValue: 8,
        recurringDaily: true,
      },
      {
        title: "Tooth Guardian",
        instructions: "Brush teeth for two full minutes.",
        powerValue: 10,
        recurringDaily: true,
      },
      {
        title: "Breakfast Boost",
        instructions: "Eat breakfast and clear your plate area.",
        powerValue: 8,
        recurringDaily: true,
      },
      {
        title: "Backpack Check",
        instructions: "Pack required school items in your backpack.",
        powerValue: 9,
        recurringDaily: true,
      },
      {
        title: "Launch Ready",
        instructions: "Put on shoes and be ready at the door.",
        powerValue: 7,
        recurringDaily: true,
      },
    ],
  },
  {
    id: "bedtime",
    name: "Bedtime",
    description: "Wind-down missions for a calm evening.",
    missions: [
      {
        title: "Pajama Power",
        instructions: "Put on pajamas before bedtime.",
        powerValue: 7,
        recurringDaily: true,
      },
      {
        title: "Toy Shutdown",
        instructions: "Put toys in bins before lights out.",
        powerValue: 9,
        recurringDaily: true,
      },
      {
        title: "Brush and Rinse",
        instructions: "Brush teeth and rinse sink area.",
        powerValue: 10,
        recurringDaily: true,
      },
      {
        title: "Bed Docking",
        instructions: "Get in bed and stay calm for story time.",
        powerValue: 8,
        recurringDaily: true,
      },
    ],
  },
  {
    id: "daily-chores",
    name: "Daily Chores",
    description: "General home-helper missions.",
    missions: [
      {
        title: "Floor Rescue",
        instructions: "Pick up items from the floor and put them away.",
        powerValue: 10,
        recurringDaily: true,
      },
      {
        title: "Laundry Assist",
        instructions: "Place dirty clothes in the hamper.",
        powerValue: 8,
        recurringDaily: true,
      },
      {
        title: "Book Patrol",
        instructions: "Put books back on the shelf.",
        powerValue: 7,
        recurringDaily: true,
      },
      {
        title: "Snack Station Reset",
        instructions: "Throw away trash and wipe the snack spot.",
        powerValue: 9,
        recurringDaily: true,
      },
      {
        title: "Toy Bin Blitz",
        instructions: "Sort toys into the right bins.",
        powerValue: 10,
        recurringDaily: true,
      },
    ],
  },
  {
    id: "school-day",
    name: "School Day",
    description: "Missions for classroom-day prep and return.",
    missions: [
      {
        title: "Homework Hero",
        instructions: "Complete assigned homework task.",
        powerValue: 12,
        recurringDaily: false,
      },
      {
        title: "Folder Finder",
        instructions: "Place school papers in the correct folder.",
        powerValue: 8,
        recurringDaily: true,
      },
      {
        title: "Lunchbox Return",
        instructions: "Put lunchbox in the kitchen after school.",
        powerValue: 7,
        recurringDaily: true,
      },
      {
        title: "Tomorrow Prep",
        instructions: "Set out outfit and backpack for tomorrow.",
        powerValue: 9,
        recurringDaily: true,
      },
    ],
  },
];
