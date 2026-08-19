// ═══════════════════════════════════════════════
// UI Component Type Declarations
// Provides proper TypeScript types for shadcn/ui .jsx components.
// These declarations override the untyped .jsx exports so that
// pages and components importing them get proper prop types.
// ═══════════════════════════════════════════════

import * as React from "react";

// ── Helper types ──
type DivRef = React.RefAttributes<HTMLDivElement>;
type DivProps = React.HTMLAttributes<HTMLDivElement> & DivRef;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & React.RefAttributes<HTMLButtonElement>;
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & React.RefAttributes<HTMLInputElement>;
type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & React.RefAttributes<HTMLTextAreaElement>;
type SpanProps = React.HTMLAttributes<HTMLSpanElement> & React.RefAttributes<HTMLSpanElement>;
type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & React.RefAttributes<HTMLHeadingElement>;
type ParaProps = React.HTMLAttributes<HTMLParagraphElement> & React.RefAttributes<HTMLParagraphElement>;

declare module "@/components/ui/card" {
  export const Card: React.ForwardRefExoticComponent<DivProps>;
  export const CardHeader: React.ForwardRefExoticComponent<DivProps>;
  export const CardTitle: React.ForwardRefExoticComponent<DivProps>;
  export const CardDescription: React.ForwardRefExoticComponent<DivProps>;
  export const CardContent: React.ForwardRefExoticComponent<DivProps>;
  export const CardFooter: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/button" {
  export const Button: React.ForwardRefExoticComponent<ButtonProps & {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
    asChild?: boolean;
  }>;
  export const buttonVariants: (props?: Record<string, any>) => string;
}

declare module "@/components/ui/input" {
  export const Input: React.ForwardRefExoticComponent<InputProps>;
}

declare module "@/components/ui/label" {
  export const Label: React.ForwardRefExoticComponent<React.LabelHTMLAttributes<HTMLLabelElement> & React.RefAttributes<HTMLLabelElement>>;
}

declare module "@/components/ui/textarea" {
  export const Textarea: React.ForwardRefExoticComponent<TextareaProps>;
}

declare module "@/components/ui/badge" {
  export const Badge: React.FC<React.HTMLAttributes<HTMLDivElement> & {
    variant?: "default" | "secondary" | "destructive" | "outline";
  }>;
  export const badgeVariants: (props?: Record<string, any>) => string;
}

declare module "@/components/ui/select" {
  export const Select: React.FC<any>;
  export const SelectGroup: React.FC<any>;
  export const SelectValue: React.FC<any>;
  export const SelectTrigger: React.ForwardRefExoticComponent<ButtonProps>;
  export const SelectContent: React.ForwardRefExoticComponent<DivProps & { position?: "popper" | "item-aligned" }>;
  export const SelectLabel: React.ForwardRefExoticComponent<DivProps>;
  export const SelectItem: React.ForwardRefExoticComponent<DivProps & { value?: string }>;
  export const SelectSeparator: React.ForwardRefExoticComponent<DivProps>;
  export const SelectScrollUpButton: React.ForwardRefExoticComponent<DivProps>;
  export const SelectScrollDownButton: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/tabs" {
  export const Tabs: React.FC<any>;
  export const TabsList: React.ForwardRefExoticComponent<DivProps>;
  export const TabsTrigger: React.ForwardRefExoticComponent<ButtonProps & { value?: string }>;
  export const TabsContent: React.ForwardRefExoticComponent<DivProps & { value?: string }>;
}

declare module "@/components/ui/switch" {
  export const Switch: React.ForwardRefExoticComponent<React.ButtonHTMLAttributes<HTMLButtonElement> & React.RefAttributes<HTMLButtonElement>>;
}

declare module "@/components/ui/alert" {
  export const Alert: React.ForwardRefExoticComponent<DivProps & { variant?: "default" | "destructive" }>;
  export const AlertTitle: React.ForwardRefExoticComponent<HeadingProps>;
  export const AlertDescription: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/dialog" {
  export const Dialog: React.FC<any>;
  export const DialogTrigger: React.FC<any>;
  export const DialogContent: React.ForwardRefExoticComponent<DivProps>;
  export const DialogHeader: React.ForwardRefExoticComponent<DivProps>;
  export const DialogFooter: React.ForwardRefExoticComponent<DivProps>;
  export const DialogTitle: React.ForwardRefExoticComponent<HeadingProps>;
  export const DialogDescription: React.ForwardRefExoticComponent<ParaProps>;
  export const DialogClose: React.FC<any>;
  export const DialogOverlay: React.FC<any>;
}

declare module "@/components/ui/sheet" {
  export const Sheet: React.FC<any>;
  export const SheetTrigger: React.FC<any>;
  export const SheetContent: React.ForwardRefExoticComponent<DivProps & { side?: "top" | "bottom" | "left" | "right" }>;
  export const SheetHeader: React.ForwardRefExoticComponent<DivProps>;
  export const SheetFooter: React.ForwardRefExoticComponent<DivProps>;
  export const SheetTitle: React.ForwardRefExoticComponent<HeadingProps>;
  export const SheetDescription: React.ForwardRefExoticComponent<ParaProps>;
  export const SheetClose: React.FC<any>;
}

declare module "@/components/ui/table" {
  export const Table: React.ForwardRefExoticComponent<DivProps>;
  export const TableHeader: React.ForwardRefExoticComponent<DivProps>;
  export const TableBody: React.ForwardRefExoticComponent<DivProps>;
  export const TableFooter: React.ForwardRefExoticComponent<DivProps>;
  export const TableHead: React.ForwardRefExoticComponent<HeadingProps>;
  export const TableRow: React.ForwardRefExoticComponent<DivProps>;
  export const TableCell: React.ForwardRefExoticComponent<DivProps>;
  export const TableCaption: React.ForwardRefExoticComponent<ParaProps>;
}

declare module "@/components/ui/progress" {
  export const Progress: React.ForwardRefExoticComponent<DivProps & { value?: number }>;
}

declare module "@/components/ui/separator" {
  export const Separator: React.ForwardRefExoticComponent<DivProps & { orientation?: "horizontal" | "vertical" }>;
}

declare module "@/components/ui/scroll-area" {
  export const ScrollArea: React.ForwardRefExoticComponent<DivProps>;
  export const ScrollBar: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/tooltip" {
  export const Tooltip: React.FC<any>;
  export const TooltipTrigger: React.FC<any>;
  export const TooltipContent: React.ForwardRefExoticComponent<DivProps>;
  export const TooltipProvider: React.FC<any>;
}

declare module "@/components/ui/avatar" {
  export const Avatar: React.ForwardRefExoticComponent<SpanProps>;
  export const AvatarImage: React.FC<any>;
  export const AvatarFallback: React.ForwardRefExoticComponent<SpanProps>;
}

declare module "@/components/ui/skeleton" {
  export const Skeleton: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/image" {
  export const Image: React.ForwardRefExoticComponent<DivProps & {
    src?: string;
    alt?: string;
    fittingType?: "fill" | "fit";
    focalPointX?: number;
    focalPointY?: number;
  }>;
}

declare module "@/components/ui/dropdown-menu" {
  export const DropdownMenu: React.FC<any>;
  export const DropdownMenuTrigger: React.FC<any>;
  export const DropdownMenuContent: React.ForwardRefExoticComponent<DivProps>;
  export const DropdownMenuItem: React.ForwardRefExoticComponent<DivProps>;
  export const DropdownMenuLabel: React.ForwardRefExoticComponent<DivProps>;
  export const DropdownMenuSeparator: React.ForwardRefExoticComponent<DivProps>;
  export const DropdownMenuGroup: React.FC<any>;
  export const DropdownMenuCheckboxItem: React.ForwardRefExoticComponent<DivProps>;
  export const DropdownMenuRadioItem: React.ForwardRefExoticComponent<DivProps>;
  export const DropdownMenuRadioGroup: React.FC<any>;
  export const DropdownMenuShortcut: React.FC<any>;
}

declare module "@/components/ui/accordion" {
  export const Accordion: React.FC<any>;
  export const AccordionItem: React.ForwardRefExoticComponent<DivProps & { value?: string }>;
  export const AccordionTrigger: React.ForwardRefExoticComponent<HeadingProps>;
  export const AccordionContent: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/alert-dialog" {
  export const AlertDialog: React.FC<any>;
  export const AlertDialogTrigger: React.FC<any>;
  export const AlertDialogContent: React.ForwardRefExoticComponent<DivProps>;
  export const AlertDialogHeader: React.ForwardRefExoticComponent<DivProps>;
  export const AlertDialogFooter: React.ForwardRefExoticComponent<DivProps>;
  export const AlertDialogTitle: React.ForwardRefExoticComponent<HeadingProps>;
  export const AlertDialogDescription: React.ForwardRefExoticComponent<ParaProps>;
  export const AlertDialogAction: React.ForwardRefExoticComponent<ButtonProps>;
  export const AlertDialogCancel: React.ForwardRefExoticComponent<ButtonProps>;
}

declare module "@/components/ui/checkbox" {
  export const Checkbox: React.ForwardRefExoticComponent<ButtonProps & { checked?: boolean }>;
}

declare module "@/components/ui/collapsible" {
  export const Collapsible: React.FC<any>;
  export const CollapsibleTrigger: React.FC<any>;
  export const CollapsibleContent: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/hover-card" {
  export const HoverCard: React.FC<any>;
  export const HoverCardTrigger: React.FC<any>;
  export const HoverCardContent: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/popover" {
  export const Popover: React.FC<any>;
  export const PopoverTrigger: React.FC<any>;
  export const PopoverContent: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/radio-group" {
  export const RadioGroup: React.ForwardRefExoticComponent<DivProps & { value?: string; onValueChange?: (v: string) => void }>;
  export const RadioGroupItem: React.ForwardRefExoticComponent<ButtonProps>;
}

declare module "@/components/ui/resizable" {
  export const ResizablePanelGroup: React.FC<any>;
  export const ResizablePanel: React.FC<any>;
  export const ResizableHandle: React.FC<any>;
}

declare module "@/components/ui/slider" {
  export const Slider: React.ForwardRefExoticComponent<DivProps & { value?: number[]; onValueChange?: (v: number[]) => void; min?: number; max?: number; step?: number }>;
}

declare module "@/components/ui/toggle" {
  export const Toggle: React.ForwardRefExoticComponent<ButtonProps & { variant?: string; size?: string }>;
  export const toggleVariants: (props?: Record<string, any>) => string;
}

declare module "@/components/ui/toggle-group" {
  export const ToggleGroup: React.FC<any>;
  export const ToggleGroupItem: React.ForwardRefExoticComponent<ButtonProps & { value?: string }>;
}

declare module "@/components/ui/command" {
  export const Command: React.FC<any>;
  export const CommandDialog: React.FC<any>;
  export const CommandInput: React.ForwardRefExoticComponent<InputProps>;
  export const CommandList: React.ForwardRefExoticComponent<DivProps>;
  export const CommandEmpty: React.ForwardRefExoticComponent<DivProps>;
  export const CommandGroup: React.ForwardRefExoticComponent<DivProps>;
  export const CommandItem: React.ForwardRefExoticComponent<DivProps & { value?: string }>;
  export const CommandShortcut: React.ForwardRefExoticComponent<SpanProps>;
  export const CommandSeparator: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/calendar" {
  export const Calendar: React.FC<any>;
}

declare module "@/components/ui/carousel" {
  export const Carousel: React.FC<any>;
  export const CarouselContent: React.ForwardRefExoticComponent<DivProps>;
  export const CarouselItem: React.ForwardRefExoticComponent<DivProps>;
  export const CarouselPrevious: React.ForwardRefExoticComponent<ButtonProps>;
  export const CarouselNext: React.ForwardRefExoticComponent<ButtonProps>;
}

declare module "@/components/ui/chart" {
  export const ChartContainer: React.FC<any>;
  export const ChartTooltip: React.FC<any>;
  export const ChartTooltipContent: React.FC<any>;
  export const ChartLegend: React.FC<any>;
  export const ChartLegendContent: React.FC<any>;
}

declare module "@/components/ui/drawer" {
  export const Drawer: React.FC<any>;
  export const DrawerTrigger: React.FC<any>;
  export const DrawerContent: React.ForwardRefExoticComponent<DivProps>;
  export const DrawerHeader: React.ForwardRefExoticComponent<DivProps>;
  export const DrawerFooter: React.ForwardRefExoticComponent<DivProps>;
  export const DrawerTitle: React.ForwardRefExoticComponent<HeadingProps>;
  export const DrawerDescription: React.ForwardRefExoticComponent<ParaProps>;
}

declare module "@/components/ui/form" {
  export const Form: React.FC<any>;
  export const FormField: React.FC<any>;
  export const FormItem: React.ForwardRefExoticComponent<DivProps>;
  export const FormLabel: React.ForwardRefExoticComponent<React.LabelHTMLAttributes<HTMLLabelElement> & React.RefAttributes<HTMLLabelElement>>;
  export const FormControl: React.FC<any>;
  export const FormDescription: React.ForwardRefExoticComponent<ParaProps>;
  export const FormMessage: React.ForwardRefExoticComponent<ParaProps>;
  export const useFormField: () => any;
}

declare module "@/components/ui/input-otp" {
  export const InputOTP: React.ForwardRefExoticComponent<DivProps & { value?: string; onChange?: (v: string) => void; maxLength?: number }>;
  export const InputOTPGroup: React.ForwardRefExoticComponent<DivProps>;
  export const InputOTPSlot: React.ForwardRefExoticComponent<DivProps & { index?: number }>;
  export const InputOTPSeparator: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/pagination" {
  export const Pagination: React.ForwardRefExoticComponent<DivProps>;
  export const PaginationContent: React.ForwardRefExoticComponent<DivProps>;
  export const PaginationItem: React.ForwardRefExoticComponent<DivProps>;
  export const PaginationLink: React.ForwardRefExoticComponent<ButtonProps & { isActive?: boolean }>;
  export const PaginationPrevious: React.ForwardRefExoticComponent<ButtonProps>;
  export const PaginationNext: React.ForwardRefExoticComponent<ButtonProps>;
  export const PaginationEllipsis: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/sidebar" {
  export const Sidebar: React.FC<any>;
  export const SidebarTrigger: React.ForwardRefExoticComponent<ButtonProps>;
  export const SidebarRail: React.FC<any>;
  export const SidebarInset: React.FC<any>;
  export const SidebarInput: React.ForwardRefExoticComponent<InputProps>;
  export const SidebarHeader: React.ForwardRefExoticComponent<DivProps>;
  export const SidebarFooter: React.ForwardRefExoticComponent<DivProps>;
  export const SidebarContent: React.ForwardRefExoticComponent<DivProps>;
  export const SidebarGroup: React.ForwardRefExoticComponent<DivProps>;
  export const SidebarGroupLabel: React.ForwardRefExoticComponent<DivProps>;
  export const SidebarMenu: React.ForwardRefExoticComponent<DivProps>;
  export const SidebarMenuItem: React.ForwardRefExoticComponent<DivProps>;
  export const SidebarMenuButton: React.ForwardRefExoticComponent<ButtonProps & { isActive?: boolean; tooltip?: string }>;
  export const SidebarMenuAction: React.FC<any>;
  export const SidebarMenuBadge: React.FC<any>;
  export const SidebarMenuSub: React.ForwardRefExoticComponent<DivProps>;
  export const SidebarMenuSubItem: React.ForwardRefExoticComponent<DivProps>;
  export const SidebarMenuSubButton: React.ForwardRefExoticComponent<ButtonProps>;
  export const SidebarMenuSkeleton: React.FC<any>;
  export const SidebarMenuSubTrigger: React.ForwardRefExoticComponent<ButtonProps>;
  export const useSidebar: () => any;
}

declare module "@/components/ui/breadcrumb" {
  export const Breadcrumb: React.FC<any>;
  export const BreadcrumbList: React.ForwardRefExoticComponent<DivProps>;
  export const BreadcrumbItem: React.ForwardRefExoticComponent<DivProps>;
  export const BreadcrumbLink: React.ForwardRefExoticComponent<React.AnchorHTMLAttributes<HTMLAnchorElement> & React.RefAttributes<HTMLAnchorElement>>;
  export const BreadcrumbPage: React.ForwardRefExoticComponent<SpanProps>;
  export const BreadcrumbSeparator: React.ForwardRefExoticComponent<SpanProps>;
}

declare module "@/components/ui/context-menu" {
  export const ContextMenu: React.FC<any>;
  export const ContextMenuTrigger: React.FC<any>;
  export const ContextMenuContent: React.ForwardRefExoticComponent<DivProps>;
  export const ContextMenuItem: React.ForwardRefExoticComponent<DivProps>;
  export const ContextMenuCheckboxItem: React.ForwardRefExoticComponent<DivProps>;
  export const ContextMenuRadioItem: React.ForwardRefExoticComponent<DivProps>;
  export const ContextMenuLabel: React.ForwardRefExoticComponent<DivProps>;
  export const ContextMenuSeparator: React.ForwardRefExoticComponent<DivProps>;
  export const ContextMenuGroup: React.FC<any>;
  export const ContextMenuRadioGroup: React.FC<any>;
}

declare module "@/components/ui/menubar" {
  export const Menubar: React.ForwardRefExoticComponent<DivProps>;
  export const MenubarMenu: React.FC<any>;
  export const MenubarTrigger: React.ForwardRefExoticComponent<ButtonProps>;
  export const MenubarContent: React.ForwardRefExoticComponent<DivProps>;
  export const MenubarItem: React.ForwardRefExoticComponent<DivProps>;
  export const MenubarSeparator: React.ForwardRefExoticComponent<DivProps>;
  export const MenubarLabel: React.ForwardRefExoticComponent<DivProps>;
  export const MenubarCheckboxItem: React.ForwardRefExoticComponent<DivProps>;
  export const MenubarRadioItem: React.ForwardRefExoticComponent<DivProps>;
  export const MenubarRadioGroup: React.FC<any>;
}

declare module "@/components/ui/navigation-menu" {
  export const NavigationMenu: React.ForwardRefExoticComponent<DivProps>;
  export const NavigationMenuList: React.ForwardRefExoticComponent<DivProps>;
  export const NavigationMenuItem: React.ForwardRefExoticComponent<DivProps>;
  export const NavigationMenuTrigger: React.ForwardRefExoticComponent<ButtonProps>;
  export const NavigationMenuContent: React.ForwardRefExoticComponent<DivProps>;
  export const NavigationMenuLink: React.ForwardRefExoticComponent<React.AnchorHTMLAttributes<HTMLAnchorElement> & React.RefAttributes<HTMLAnchorElement>>;
  export const NavigationMenuIndicator: React.FC<any>;
  export const NavigationMenuViewport: React.ForwardRefExoticComponent<DivProps>;
}

declare module "@/components/ui/aspect-ratio" {
  export const AspectRatio: React.FC<any>;
}

declare module "@/components/ui/sonner" {
  export const Toaster: React.FC<any>;
}

declare module "@/components/ui/toaster" {
  export const Toaster: React.FC<any>;
}

declare module "@/components/ui/toast" {
  export const Toast: React.FC<any>;
  export const ToastProvider: React.FC<any>;
  export const ToastViewport: React.FC<any>;
  export const ToastTitle: React.ForwardRefExoticComponent<HeadingProps>;
  export const ToastDescription: React.ForwardRefExoticComponent<ParaProps>;
  export const ToastClose: React.FC<any>;
  export const ToastAction: React.FC<any>;
}

declare module "@/components/ui/use-toast" {
  export const useToast: () => { toast: (props: any) => void; dismiss: (id?: string) => void; toasts: any[] };
  export const toast: (props: any) => void;
}