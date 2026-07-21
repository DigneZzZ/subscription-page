import classes from './fx-blobs.module.css'

/* Глобальный «живой фон» (EFFECTS=blobs): пятна в цвет акцента темы за
   контентом любой раскладки. Aurora рисует собственные пятна внутри своей
   сцены — там этот компонент не монтируется. */
export const FxBlobs = () => (
    <div aria-hidden className={classes.blobs}>
        <i />
        <i />
        <i />
    </div>
)
