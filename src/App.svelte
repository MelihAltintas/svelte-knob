<script>
    import Knob from "./Knob.svelte"
    </script>
    
    <main>
        <Knob value={50} />
        <Knob value={30} step={10} strokeWidth={8} primaryColor="#E844C3" secondaryColor="#E7B6DC" textColor="#E844C3"/>
        <Knob value={45} min={-10} max={100} />
    
    </main>
    
    <style>
    
    </style>
    